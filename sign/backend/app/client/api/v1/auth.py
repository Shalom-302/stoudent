"""Student authentication.

The credential flow is the shared one (``auth_service``); this router only
re-exposes it on the student-facing surface so the frontend never has to call
an ``/admin`` URL.
"""
from fastapi import APIRouter, Depends, Request, Response
from fastapi_limiter.depends import RateLimiter
from starlette.background import BackgroundTasks

from backend.app.admin.schema.user import (
    ChangePasswordParam,
    ChangePhoneConfirmParam,
    ChangePhoneStartParam,
    DeleteAccountParam,
    ForgotPasswordParam,
    GetCurrentUserInfoDetail,
    ResendOtpParam,
    ResetPasswordParam,
    UserLoginSchema,
    UserRegister,
    VerifyOtpParam,
)
from backend.app.admin.service.auth_service import auth_service
from backend.app.client.service.account_service import account_service
from backend.common.response.response_schema import ResponseModel, response_base
from backend.common.security.jwt import DependsJwtAuth

router = APIRouter(prefix='/auth', tags=['Auth'])


@router.post(
    '/register',
    summary='Create a STOUDENT account (WhatsApp number, pseudo, filière)',
    # Per-IP guard, kept loose (CI mobile carriers share IPs); the real anti-spam
    # limit is per phone number in otp_service.
    dependencies=[Depends(RateLimiter(times=10, minutes=10))],
)
async def register(
    request: Request,
    response: Response,
    obj: UserRegister,
    background_tasks: BackgroundTasks,
) -> ResponseModel:
    data = await auth_service.register(
        request=request, response=response, obj=obj, background_tasks=background_tasks
    )
    return response_base.success(request=request, data=data)


@router.post(
    '/login',
    summary='Log in',
    dependencies=[Depends(RateLimiter(times=5, minutes=1))],  # brute-force guard
)
async def login(
    request: Request,
    response: Response,
    obj: UserLoginSchema,
    background_tasks: BackgroundTasks,
) -> ResponseModel:
    data = await auth_service.login(
        request=request, response=response, obj=obj, background_tasks=background_tasks
    )
    return response_base.success(request=request, data=data)


@router.post(
    '/verify-otp',
    summary='Verify the WhatsApp sign-up code and activate the account',
    dependencies=[Depends(RateLimiter(times=10, minutes=10))],
)
async def verify_otp(request: Request, response: Response, obj: VerifyOtpParam) -> ResponseModel:
    data = await auth_service.verify_otp(request=request, response=response, obj=obj)
    return response_base.success(request=request, data=data)


@router.post(
    '/resend-otp',
    summary='Resend the WhatsApp sign-up code',
    dependencies=[Depends(RateLimiter(times=3, minutes=10))],
)
async def resend_otp(request: Request, obj: ResendOtpParam) -> ResponseModel:
    data = await auth_service.resend_otp(request=request, obj=obj)
    return response_base.success(request=request, data=data)


@router.post(
    '/forgot-password',
    summary='Send a password reset code on WhatsApp',
    dependencies=[Depends(RateLimiter(times=3, minutes=10))],
)
async def forgot_password(request: Request, obj: ForgotPasswordParam) -> ResponseModel:
    data = await auth_service.forgot_password(obj=obj)
    return response_base.success(request=request, data=data)


@router.post(
    '/reset-password',
    summary='Choose a new password with the WhatsApp code',
    dependencies=[Depends(RateLimiter(times=10, minutes=10))],
)
async def reset_password(request: Request, obj: ResetPasswordParam) -> ResponseModel:
    data = await auth_service.reset_password(obj=obj)
    return response_base.success(request=request, data=data)


@router.post('/refresh', summary='Exchange the refresh cookie for a new token')
async def refresh(request: Request, response: Response) -> ResponseModel:
    data = await auth_service.new_token(request=request, response=response)
    return response_base.success(request=request, data=data)


@router.post('/logout', summary='Log out', dependencies=[DependsJwtAuth])
async def logout(request: Request, response: Response) -> ResponseModel:
    await auth_service.logout(request=request, response=response)
    return response_base.success(request=request)


@router.post(
    '/password',
    summary='Change my password (signs out my other devices)',
    dependencies=[DependsJwtAuth, Depends(RateLimiter(times=5, minutes=10))],
)
async def change_password(request: Request, response: Response, obj: ChangePasswordParam) -> ResponseModel:
    data = await account_service.change_password(
        user_id=request.user.id, old_password=obj.old_password, new_password=obj.new_password, response=response
    )
    return response_base.success(request=request, data=data)


@router.post(
    '/phone/start',
    summary='Send a code to my new WhatsApp number',
    dependencies=[DependsJwtAuth, Depends(RateLimiter(times=3, minutes=10))],
)
async def start_phone_change(request: Request, obj: ChangePhoneStartParam) -> ResponseModel:
    data = await account_service.start_phone_change(user_id=request.user.id, password=obj.password, phone=obj.phone)
    return response_base.success(request=request, data=data)


@router.post(
    '/phone/confirm',
    summary='Confirm my new WhatsApp number with the code',
    dependencies=[DependsJwtAuth, Depends(RateLimiter(times=10, minutes=10))],
)
async def confirm_phone_change(request: Request, obj: ChangePhoneConfirmParam) -> ResponseModel:
    data = await account_service.confirm_phone_change(user_id=request.user.id, phone=obj.phone, code=obj.code)
    return response_base.success(request=request, data=data)


@router.post(
    '/delete-account',
    summary='Delete my account (personal data erased, posts anonymised)',
    dependencies=[DependsJwtAuth, Depends(RateLimiter(times=5, minutes=10))],
)
async def delete_account(request: Request, response: Response, obj: DeleteAccountParam) -> ResponseModel:
    await account_service.delete_account(user_id=request.user.id, password=obj.password, response=response)
    return response_base.success(request=request)


@router.get('/me', summary='Current authenticated account', dependencies=[DependsJwtAuth])
async def me(request: Request) -> ResponseModel:
    data = GetCurrentUserInfoDetail(**request.user.model_dump())
    return response_base.success(request=request, data=data)
