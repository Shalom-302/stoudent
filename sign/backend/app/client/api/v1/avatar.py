"""Avatar customisation and world transform persistence."""
from fastapi import APIRouter, Request

from backend.app.client.schema.student import (
    AvatarDetail,
    AvatarTransformParam,
    UpsertAvatarParam,
)
from backend.app.client.service.student_service import student_service
from backend.common.response.response_schema import ResponseModel, response_base
from backend.common.security.jwt import DependsJwtAuth

router = APIRouter(prefix='/avatar', tags=['Avatar'])


@router.get('', summary='Get my avatar', dependencies=[DependsJwtAuth])
async def get_avatar(request: Request) -> ResponseModel:
    data = await student_service.get_avatar(user_id=request.user.id)
    return response_base.success(request=request, data=AvatarDetail(**data))


@router.post('', summary='Create or replace my avatar', dependencies=[DependsJwtAuth])
async def create_avatar(request: Request, obj: UpsertAvatarParam) -> ResponseModel:
    data = await student_service.upsert_avatar(user_id=request.user.id, obj=obj)
    return response_base.success(request=request, data=AvatarDetail(**data))


@router.patch('', summary='Update my avatar', dependencies=[DependsJwtAuth])
async def update_avatar(request: Request, obj: UpsertAvatarParam) -> ResponseModel:
    data = await student_service.upsert_avatar(user_id=request.user.id, obj=obj)
    return response_base.success(request=request, data=AvatarDetail(**data))


@router.put(
    '/transform',
    summary='Save where my avatar stands in the world',
    dependencies=[DependsJwtAuth],
)
async def save_transform(request: Request, obj: AvatarTransformParam) -> ResponseModel:
    data = await student_service.save_transform(user_id=request.user.id, obj=obj)
    return response_base.success(request=request, data=AvatarDetail(**data))
