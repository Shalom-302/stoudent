from fastapi import Request, Response
from fastapi.security import HTTPBasicCredentials
from datetime import datetime
from starlette.background import BackgroundTask, BackgroundTasks

from backend.app.client.service.otp_service import otp_service
from backend.crud.crud_student import student_dao
from backend.crud.crud_user import user_dao
from backend.models.user import User
from backend.app.admin.schema.token import GetLoginToken, GetNewToken
from backend.app.admin.schema.user import (
    ForgotPasswordParam,
    ResendOtpParam,
    ResetPasswordParam,
    UserLoginSchema,
    UserRegister,
    VerifyOtpParam,
)
from backend.app.admin.service.login_log_service import LoginLogService
from backend.common.enums import LoginLogStatusType
from backend.common.exception import errors
from backend.common.security.jwt import (
    create_access_token,
    create_new_token,
    create_refresh_token,
    get_hash_password,
    get_token,
    jwt_decode,
    password_verify,
)
from backend.core.conf import settings
from backend.database.db_postgres import async_db_session
from backend.database.db_redis import redis_client
from backend.utils.timezone import timezone
from backend.utils.translator import Translator


# Prefix the web form recognises to route an unverified login to the code screen.
OTP_REQUIRED_PREFIX = 'OTP_REQUIRED'


def _set_refresh_cookie(response: Response, refresh_token: str, expire_time) -> None:
    response.set_cookie(
        key=settings.COOKIE_REFRESH_TOKEN_KEY,
        value=refresh_token,
        max_age=settings.COOKIE_REFRESH_TOKEN_EXPIRE_SECONDS,
        expires=timezone.f_utc(expire_time),
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE or settings.ENVIRONMENT != 'dev',
    )


class AuthService:
    @staticmethod
    async def swagger_login(*, obj: HTTPBasicCredentials) -> tuple[str, User]:
        async with async_db_session.begin() as db:
            current_user = await user_dao.get_by_email(db, obj.username)
            if not current_user:
                raise errors.NotFoundError(msg='Incorrect email or password')
            elif not password_verify(f'{obj.password}{current_user.salt}', current_user.password):
                raise errors.AuthorizationError(msg='Incorrect email or password')
            elif not current_user.status:
                raise errors.AuthorizationError(msg='The user has been locked out. Please contact the system useristrator.')
            access_token = await create_access_token(str(current_user.x_id), False)
            await user_dao.update_login_time(db, obj.username)
            return access_token.access_token, current_user

    @staticmethod
    async def register(
        *, request: Request, response: Response, obj: UserRegister, background_tasks: BackgroundTasks
        ) -> GetLoginToken:
        translator = Translator(request.state.locale)

        async with async_db_session.begin() as db:
            if not obj.password:
                raise errors.ForbiddenError(msg=translator.t('auth.enpty_password'))
            
            # STOUDENT sign-up: the WhatsApp number identifies the account, the
            # pseudo is what the community sees, the filière is mandatory.
            if not obj.phone:
                raise errors.ForbiddenError(msg='Le numéro WhatsApp est obligatoire.')
            if not obj.pseudo:
                raise errors.ForbiddenError(msg='Choisissez un pseudo.')
            if not obj.filiere:
                raise errors.ForbiddenError(msg='La filière est obligatoire.')
            if await user_dao.get_by_phone(db, obj.phone):
                raise errors.ForbiddenError(msg='Un compte existe déjà avec ce numéro.')
            if await user_dao.get_by_pseudo(db, obj.pseudo):
                raise errors.ForbiddenError(msg='Ce pseudo est déjà pris.')
            if obj.email and await user_dao.get_by_email(db, obj.email):
                raise errors.ForbiddenError(msg=translator.t('auth.exist'))

            # Always the plain 'user' role: declaring yourself a teacher is
            # recorded on the profile, the 'teacher' role is granted by an admin.
            new_user = await user_dao.add(db, obj)

            profile = await student_dao.create_for_user(db, new_user.id)
            profile.filiere = obj.filiere
            profile.institution = obj.institution
            profile.level = obj.level
            profile.member_type = obj.member_type
            if obj.whatsapp_opt_in:
                profile.whatsapp_opt_in = True
                profile.whatsapp_opt_in_at = timezone.now()
            await db.flush()

            # WhatsApp OTP gate: create the account UNVERIFIED, send the code, and
            # return without tokens - the member logs in only after /auth/verify-otp.
            # A gowa failure raises here, rolling back the whole registration so no
            # orphan unverified account is left behind.
            if settings.OTP_ENABLED:
                new_user.email_verified = False
                await db.flush()
                await otp_service.start(new_user.phone)
                return {'otp_required': True, 'phone': new_user.phone}

            # current_user_id = new_user.x_id
            # is_multi_login = new_user.is_multi_login
            user_x_id = new_user.x_id
            email = new_user.email or new_user.phone
            
            access_token = await create_access_token(str(user_x_id), settings.TOKEN_MULTI_LOGIN)
            refresh_token = await create_refresh_token(str(user_x_id), settings.TOKEN_MULTI_LOGIN)

            n_user = await user_dao.get_with_relation(db, x_id=user_x_id, populates=['roles'])
        
            background_tasks.add_task(
                LoginLogService.create,
                **dict(
                    db=db,
                    request=request,
                    user_x_id=user_x_id,
                    email=email,
                    login_time=datetime.now(),
                    status=LoginLogStatusType.success.value,
                    msg=translator.t('auth.successful'),
                )
            )

            # await user_dao.update_login_time(db, obj.email)
            response.set_cookie(
                key=settings.COOKIE_REFRESH_TOKEN_KEY,
                value=refresh_token.refresh_token,
                max_age=settings.COOKIE_REFRESH_TOKEN_EXPIRE_SECONDS,
                expires=timezone.f_utc(refresh_token.refresh_token_expire_time),
                httponly=True,
                samesite=settings.COOKIE_SAMESITE,
                secure=settings.COOKIE_SECURE or settings.ENVIRONMENT != 'dev',
            )
            
            data = GetLoginToken(
                access_token=access_token.access_token,
                access_token_expire_time=access_token.access_token_expire_time,
                user=n_user,  # type: ignore
            )
            return data


    @staticmethod
    async def login(
        *, request: Request, response: Response, obj: UserLoginSchema, background_tasks: BackgroundTasks
    ) -> GetLoginToken:
        translator = Translator(request.state.locale)

        async with async_db_session.begin() as db:
            try:
                current_user = await user_dao.get_by_identifier(db, obj.identifier, populates=['roles'])
                if not current_user:
                    raise errors.NotFoundError(msg=translator.t('auth.incorrect_credential'))

                user_x_id = current_user.x_id
                email = current_user.email or current_user.phone

                fail_key = f'{settings.LOGIN_FAIL_REDIS_PREFIX}:{user_x_id}'
                if int(await redis_client.get(fail_key) or 0) >= settings.LOGIN_MAX_FAILURES:
                    raise errors.AuthorizationError(
                        msg='Trop de tentatives sur ce compte. Réessayez dans 15 minutes '
                        'ou utilisez « Mot de passe oublié ».')
                if not password_verify(obj.password + current_user.salt, current_user.password):
                    failures = await redis_client.incr(fail_key)
                    if failures == 1:
                        await redis_client.expire(fail_key, settings.LOGIN_LOCK_SECONDS)
                    raise errors.AuthorizationError(msg=translator.t('auth.incorrect_credential'))
                elif not current_user.status:
                    raise errors.AuthorizationError(msg=translator.t('auth.account_locked'))
                elif settings.OTP_ENABLED and not current_user.email_verified:
                    raise errors.AuthorizationError(
                        msg=f'{OTP_REQUIRED_PREFIX}: compte non vérifié, entrez le code reçu par WhatsApp.')

                access_token = await create_access_token(str(user_x_id), settings.TOKEN_MULTI_LOGIN)
                refresh_token = await create_refresh_token(str(user_x_id), settings.TOKEN_MULTI_LOGIN)

            except errors.NotFoundError as e:
                # Same 401 as a wrong password: the login form must not reveal
                # which numbers have an account.
                raise errors.AuthorizationError(msg=e.msg)
            except (errors.AuthorizationError, errors.CustomError) as e:
                task = BackgroundTask(
                    LoginLogService.create,
                    **dict(
                        db=db,
                        request=request,
                        user_x_id=user_x_id,
                        email=email,
                        login_time=datetime.now(),
                        status=LoginLogStatusType.fail.value,
                        msg=e.msg,
                    ),
                )
                raise errors.AuthorizationError(msg=e.msg, background=task)
            except Exception as e:
                raise e
            else:
                background_tasks.add_task(
                    LoginLogService.create,
                    **dict(
                        db=db,
                        request=request,
                        user_x_id=user_x_id,
                        email=email,
                        login_time=datetime.now(),
                        status=LoginLogStatusType.success.value,
                        msg=translator.t('auth.successful'),
                    ),
                )
                # await redis_client.delete(f'{user_settings.CAPTCHA_LOGIN_REDIS_PREFIX}:{request.state.ip}')

                await redis_client.delete(f'{settings.LOGIN_FAIL_REDIS_PREFIX}:{user_x_id}')
                await user_dao.update_login_time_by_x_id(db, user_x_id)
                # Same flags as everywhere else: the previous samesite='none'
                # without Secure was silently dropped by browsers.
                _set_refresh_cookie(response, refresh_token.refresh_token, refresh_token.refresh_token_expire_time)
                await db.refresh(current_user)
                data = GetLoginToken(
                    access_token=access_token.access_token,
                    access_token_expire_time=access_token.access_token_expire_time,
                    user=current_user,  # type: ignore
                )
                return data


    @staticmethod
    async def verify_otp(*, request: Request, response: Response, obj: VerifyOtpParam) -> GetLoginToken:
        translator = Translator(request.state.locale)
        async with async_db_session.begin() as db:
            user = await user_dao.get_by_phone(db, obj.phone)
            if not user:
                raise errors.NotFoundError(msg=translator.t('auth.incorrect_credential'))
            if not user.status:
                raise errors.AuthorizationError(msg=translator.t('auth.account_locked'))
            if user.email_verified:
                # A code is never a password substitute for a verified account.
                raise errors.ForbiddenError(msg='Ce compte est déjà vérifié, connectez-vous.')
            await otp_service.verify(obj.phone, obj.code)  # raises on bad/expired code
            user.email_verified = True
            await db.flush()
            x_id = user.x_id
            access_token = await create_access_token(str(x_id), settings.TOKEN_MULTI_LOGIN)
            refresh_token = await create_refresh_token(str(x_id), settings.TOKEN_MULTI_LOGIN)
            n_user = await user_dao.get_with_relation(db, x_id=x_id, populates=['roles'])
        _set_refresh_cookie(response, refresh_token.refresh_token, refresh_token.refresh_token_expire_time)
        return GetLoginToken(
            access_token=access_token.access_token,
            access_token_expire_time=access_token.access_token_expire_time,
            user=n_user,  # type: ignore
        )

    @staticmethod
    async def resend_otp(*, request: Request, obj: ResendOtpParam) -> dict:
        translator = Translator(request.state.locale)
        async with async_db_session() as db:
            user = await user_dao.get_by_phone(db, obj.phone)
        if not user:
            raise errors.NotFoundError(msg=translator.t('auth.incorrect_credential'))
        if user.email_verified:
            raise errors.ForbiddenError(msg='Ce compte est déjà vérifié.')
        if not await otp_service.can_resend(obj.phone):
            raise errors.ForbiddenError(msg='Patientez un instant avant de redemander un code.')
        await otp_service.start(obj.phone)
        await otp_service.mark_resent(obj.phone)
        return {'sent': True}

    @staticmethod
    async def forgot_password(*, obj: ForgotPasswordParam) -> dict:
        """Send a reset code on WhatsApp.

        The answer is the same whether the number has an account or not, so
        the form cannot be used to find out who is registered.
        """
        async with async_db_session() as db:
            user = await user_dao.get_by_phone(db, obj.phone)
        if user and user.status:
            if not await otp_service.can_resend(obj.phone, 'reset'):
                raise errors.ForbiddenError(msg='Patientez un instant avant de redemander un code.')
            await otp_service.start(obj.phone, 'reset')
            await otp_service.mark_resent(obj.phone, 'reset')
        return {'sent': True}

    @staticmethod
    async def reset_password(*, obj: ResetPasswordParam) -> dict:
        async with async_db_session.begin() as db:
            user = await user_dao.get_by_phone(db, obj.phone)
            if not user or not user.status:
                # Same message as a wrong code: no hint about the account.
                raise errors.ForbiddenError(msg='Code expiré ou introuvable. Demandez un nouveau code.')
            await otp_service.verify(obj.phone, obj.code, 'reset')  # raises on bad/expired code
            user.password = get_hash_password(f'{obj.new_password}{user.salt}')
            # The code proved the member owns the number.
            user.email_verified = True
            user_x_id = user.x_id
        # Whoever knew the old password is signed out everywhere.
        await redis_client.delete_prefix(f'{settings.TOKEN_REDIS_PREFIX}:{user_x_id}:')
        await redis_client.delete_prefix(f'{settings.TOKEN_REFRESH_REDIS_PREFIX}:{user_x_id}:')
        await redis_client.delete(f'{settings.JWT_USER_REDIS_PREFIX}:{user_x_id}')
        await redis_client.delete(f'{settings.LOGIN_FAIL_REDIS_PREFIX}:{user_x_id}')
        return {'reset': True}

    @staticmethod
    async def new_token(*, request: Request, response: Response) -> GetNewToken:
        translator = Translator(request.state.locale)
        refresh_token = request.cookies.get(settings.COOKIE_REFRESH_TOKEN_KEY)

        if not refresh_token:
            raise errors.TokenError(msg=translator.t('auth.refresh_token_not_found'))
        try:
            user_x_id = jwt_decode(refresh_token)
        except Exception:
            raise errors.TokenError(msg=translator.t('auth.invalid_refresh_token'))
        # if request.user.id != user_id:
        #     raise errors.TokenError(msg='Refresh Token is invalid')
        async with async_db_session() as db:
            current_user = await user_dao.get_by_x_id(db, user_x_id)
            if not current_user:
                raise errors.NotFoundError(msg=translator.t('auth.incorrect_credential'))
            elif not current_user.status:
                raise errors.AuthorizationError(msg=translator.t('auth.account_locked'))
            # The access token may be long gone (browser reopened weeks later):
            # the refresh cookie alone is enough to resume the session.
            try:
                current_token = get_token(request)
            except Exception:  # noqa: BLE001
                current_token = None
            new_token = await create_new_token(
                sub=str(current_user.x_id),
                token=current_token,
                refresh_token=refresh_token,
                multi_login=settings.TOKEN_MULTI_LOGIN,
            )
            response.set_cookie(
                key=settings.COOKIE_REFRESH_TOKEN_KEY,
                value=new_token.new_refresh_token,
                max_age=settings.COOKIE_REFRESH_TOKEN_EXPIRE_SECONDS,
                expires=timezone.f_utc(new_token.new_refresh_token_expire_time),
                httponly=True,
                samesite=settings.COOKIE_SAMESITE,
                secure=settings.COOKIE_SECURE or settings.ENVIRONMENT != 'dev',
            )
            data = GetNewToken(
                access_token=new_token.new_access_token,
                access_token_expire_time=new_token.new_access_token_expire_time,
            )
            return data


    @staticmethod
    async def logout(*, request: Request, response: Response) -> None:
        token = get_token(request)
        refresh_token = request.cookies.get(settings.COOKIE_REFRESH_TOKEN_KEY)
        response.delete_cookie(settings.COOKIE_REFRESH_TOKEN_KEY)
        if settings.TOKEN_MULTI_LOGIN:
            # Sign out THIS device only; the member's other devices stay in.
            await redis_client.delete(f'{settings.TOKEN_REDIS_PREFIX}:{request.user.x_id}:{token}')
            if refresh_token:
                await redis_client.delete(f'{settings.TOKEN_REFRESH_REDIS_PREFIX}:{request.user.x_id}:{refresh_token}')
            return
        key_prefix = f'{settings.TOKEN_REDIS_PREFIX}:{request.user.x_id}:'
        await redis_client.delete_prefix(key_prefix)
        key_prefix = f'{settings.TOKEN_REFRESH_REDIS_PREFIX}:{request.user.x_id}:'
        await redis_client.delete_prefix(key_prefix)


auth_service = AuthService()
