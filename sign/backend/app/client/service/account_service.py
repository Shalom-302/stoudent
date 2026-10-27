"""The member's own account: password, WhatsApp number, deletion.

Every change re-checks the current password: a session left open on a shared
phone in a cyber café must not be enough to take an account over.
"""
import secrets

from fastapi import Response
from sqlalchemy import delete, select

from backend.app.admin.service.auth_service import _set_refresh_cookie
from backend.app.client.service.otp_service import otp_service
from backend.common.exception import errors
from backend.common.security.jwt import create_access_token, create_refresh_token, get_hash_password, password_verify
from backend.core.conf import settings
from backend.crud.crud_user import user_dao
from backend.database.db_postgres import async_db_session
from backend.database.db_redis import redis_client
from backend.models import LoginLog, StudentProfile, User

PENDING_PHONE_PREFIX = 'stoudent:pending_phone'


async def _revoke_all_sessions(user_x_id: str) -> None:
    await redis_client.delete_prefix(f'{settings.TOKEN_REDIS_PREFIX}:{user_x_id}:')
    await redis_client.delete_prefix(f'{settings.TOKEN_REFRESH_REDIS_PREFIX}:{user_x_id}:')
    await redis_client.delete(f'{settings.JWT_USER_REDIS_PREFIX}:{user_x_id}')


async def _check_password(db, user_id: int, password: str) -> User:
    user = await db.get(User, user_id)
    if user is None or not password_verify(f'{password}{user.salt}', user.password):
        raise errors.ForbiddenError(msg='Mot de passe actuel incorrect.')
    return user


class AccountService:
    @staticmethod
    async def change_password(*, user_id: int, old_password: str, new_password: str, response: Response) -> dict:
        """Change the password, sign out every other device, keep this one in."""
        async with async_db_session.begin() as db:
            user = await _check_password(db, user_id, old_password)
            if old_password == new_password:
                raise errors.ForbiddenError(msg='Le nouveau mot de passe doit être différent de l’ancien.')
            user.password = get_hash_password(f'{new_password}{user.salt}')
            x_id = user.x_id
        await _revoke_all_sessions(x_id)
        access = await create_access_token(x_id, settings.TOKEN_MULTI_LOGIN)
        refresh = await create_refresh_token(x_id, settings.TOKEN_MULTI_LOGIN)
        _set_refresh_cookie(response, refresh.refresh_token, refresh.refresh_token_expire_time)
        return {'access_token': access.access_token, 'access_token_expire_time': access.access_token_expire_time}

    @staticmethod
    async def start_phone_change(*, user_id: int, password: str, phone: str) -> dict:
        """Send a code to the NEW number: it must be the member's own WhatsApp."""
        async with async_db_session() as db:
            user = await _check_password(db, user_id, password)
            if user.phone == phone:
                raise errors.ForbiddenError(msg='C’est déjà votre numéro.')
            if await user_dao.get_by_phone(db, phone):
                raise errors.ForbiddenError(msg='Ce numéro est déjà utilisé par un autre compte.')
        if not await otp_service.can_resend(phone, 'phone'):
            raise errors.ForbiddenError(msg='Patientez un instant avant de redemander un code.')
        await redis_client.setex(f'{PENDING_PHONE_PREFIX}:{user_id}', settings.OTP_TTL_SECONDS, phone)
        await otp_service.start(phone, 'phone')
        await otp_service.mark_resent(phone, 'phone')
        return {'sent': True}

    @staticmethod
    async def confirm_phone_change(*, user_id: int, phone: str, code: str) -> dict:
        pending = await redis_client.get(f'{PENDING_PHONE_PREFIX}:{user_id}')
        if pending != phone:
            raise errors.ForbiddenError(msg='Demandez d’abord un code pour ce numéro.')
        await otp_service.verify(phone, code, 'phone')  # raises on bad/expired code
        async with async_db_session.begin() as db:
            if await user_dao.get_by_phone(db, phone):
                raise errors.ForbiddenError(msg='Ce numéro est déjà utilisé par un autre compte.')
            user = await db.get(User, user_id)
            user.phone = phone
            user.email_verified = True
            x_id = user.x_id
        await redis_client.delete(f'{PENDING_PHONE_PREFIX}:{user_id}')
        # The cached user snapshot carries the old number.
        await redis_client.delete(f'{settings.JWT_USER_REDIS_PREFIX}:{x_id}')
        return {'phone': phone}

    @staticmethod
    async def delete_account(*, user_id: int, password: str, response: Response) -> None:
        """Erase the member's personal data; keep their posts, anonymised.

        Questions and answers stay: deleting a question would also delete the
        answers other members wrote to it. What identifies the person goes:
        number, email, pseudo, names, password, profile details, consent,
        security logs. Their posts then show as an anonymous member.
        """
        async with async_db_session.begin() as db:
            user = await _check_password(db, user_id, password)
            if any(role.name == 'admin' for role in (user.roles or [])):
                raise errors.ForbiddenError(msg='Un compte administrateur ne peut pas être supprimé ainsi.')
            x_id = user.x_id
            user.phone = None
            user.email = None
            user.pseudo = None
            user.firstname = None
            user.lastname = None
            user.status = False
            user.password = get_hash_password(secrets.token_urlsafe(32) + (user.salt or ''))
            profile = (
                await db.execute(select(StudentProfile).where(StudentProfile.user_id == user_id))
            ).unique().scalars().first()
            if profile is not None:
                profile.bio = None
                profile.institution = None
                profile.level = None
                profile.whatsapp_opt_in = False
                profile.whatsapp_opt_in_at = None
            await db.execute(delete(LoginLog).where(LoginLog.user_x_id == x_id))
        await _revoke_all_sessions(x_id)
        response.delete_cookie(settings.COOKIE_REFRESH_TOKEN_KEY)


account_service = AccountService()
