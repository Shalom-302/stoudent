"""SignManager — the back-office for the whole platform.

Every route here is admin-only. The guard is a role check rather than a Casbin
policy on purpose: locking the back-office behind a policy table that has to be
seeded correctly is how an empty database becomes an open back-office.
"""
from typing import Annotated

from fastapi import APIRouter, Path, Query, Request

from backend.app.admin.schema.signmanager import (
    ManagedStudent,
    ManagedStudentDetail,
    OverviewDetail,
    UpdateStudentRolesParam,
    UpdateStudentStatusParam,
)
from backend.app.admin.service.signmanager_service import signmanager_service
from backend.common.response.response_schema import ResponseModel, response_base
from backend.common.security.jwt import DependsJwtAuth
from backend.common.security.roles import DependsAdmin

router = APIRouter(prefix='/signmanager', tags=['SignManager'])

XIdPath = Annotated[str, Path(min_length=8, max_length=32, pattern=r'^[a-z0-9]+$')]


@router.get(
    '/overview',
    summary='Platform counters and per-experiment funnel',
    dependencies=[DependsJwtAuth, DependsAdmin],
)
async def overview(request: Request) -> ResponseModel:
    data = await signmanager_service.overview()
    return response_base.success(request=request, data=OverviewDetail(**data))


@router.get(
    '/students',
    summary='List every student with their progression',
    dependencies=[DependsJwtAuth, DependsAdmin],
)
async def list_students(
    request: Request,
    search: Annotated[str | None, Query(max_length=120)] = None,
    status: Annotated[bool | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ResponseModel:
    data = await signmanager_service.list_students(
        search=search, status=status, page=page, size=size
    )
    data['items'] = [ManagedStudent(**item) for item in data['items']]
    return response_base.success(request=request, data=data)


@router.get(
    '/students/{x_id}',
    summary='One student: profile, experiments, badges',
    dependencies=[DependsJwtAuth, DependsAdmin],
)
async def get_student(request: Request, x_id: XIdPath) -> ResponseModel:
    data = await signmanager_service.get_student(x_id=x_id)
    return response_base.success(request=request, data=ManagedStudentDetail(**data))


@router.patch(
    '/students/{x_id}/status',
    summary='Activate or deactivate an account',
    dependencies=[DependsJwtAuth, DependsAdmin],
)
async def set_student_status(
    request: Request, x_id: XIdPath, obj: UpdateStudentStatusParam
) -> ResponseModel:
    await signmanager_service.set_status(x_id=x_id, obj=obj, actor_id=request.user.id)
    return response_base.success(request=request)


@router.patch(
    '/students/{x_id}/roles',
    summary='Replace a student roles',
    dependencies=[DependsJwtAuth, DependsAdmin],
)
async def set_student_roles(
    request: Request, x_id: XIdPath, obj: UpdateStudentRolesParam
) -> ResponseModel:
    await signmanager_service.set_roles(x_id=x_id, obj=obj, actor_id=request.user.id)
    return response_base.success(request=request)
