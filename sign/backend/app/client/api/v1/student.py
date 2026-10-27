"""Student profile, MyLab progression and badges."""
from typing import Annotated

from fastapi import APIRouter, Query, Request

from backend.app.client.schema.student import (
    AchievementDetail,
    ProgressDetail,
    StudentDetail,
    UpdateStudentProfileParam,
)
from backend.app.client.service.student_service import student_service
from backend.common.response.response_schema import ResponseModel, response_base
from backend.common.security.jwt import DependsJwtAuth

router = APIRouter(prefix='/students', tags=['Student'])


@router.get('/me', summary='Get my student profile', dependencies=[DependsJwtAuth])
async def get_me(request: Request) -> ResponseModel:
    data = await student_service.get_profile(user_id=request.user.id)
    return response_base.success(request=request, data=StudentDetail(**data))


@router.patch('/me', summary='Update my student profile', dependencies=[DependsJwtAuth])
async def update_me(request: Request, obj: UpdateStudentProfileParam) -> ResponseModel:
    data = await student_service.update_profile(user_id=request.user.id, obj=obj)
    return response_base.success(request=request, data=StudentDetail(**data))


@router.get('/me/progress', summary='Global progression', dependencies=[DependsJwtAuth])
async def get_progress(request: Request) -> ResponseModel:
    data = await student_service.get_progress(user_id=request.user.id)
    return response_base.success(request=request, data=ProgressDetail(**data))


@router.get('/me/achievements', summary='Badge wall', dependencies=[DependsJwtAuth])
async def get_achievements(request: Request) -> ResponseModel:
    data = await student_service.get_achievements(user_id=request.user.id)
    return response_base.success(
        request=request, data=[AchievementDetail(**item) for item in data]
    )


@router.get('/me/history', summary='Recent experiments', dependencies=[DependsJwtAuth])
async def get_history(
    request: Request,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ResponseModel:
    data = await student_service.get_history(user_id=request.user.id, limit=limit)
    return response_base.success(request=request, data=data)
