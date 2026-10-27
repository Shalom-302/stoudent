"""Running, saving and validating an experiment."""
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Request
from fastapi_limiter.depends import RateLimiter

from backend.app.client.schema.lab import (
    ExperimentDetail,
    SaveExperimentStateParam,
    StartExperimentResult,
    SubmitExperimentParam,
    SubmitExperimentResult,
)
from backend.app.client.service.experiment_service import experiment_service
from backend.common.response.response_schema import ResponseModel, response_base
from backend.common.security.jwt import DependsJwtAuth

router = APIRouter(prefix='/experiments', tags=['Experiments'])

SlugPath = Annotated[str, Path(min_length=2, max_length=200, pattern=r'^[a-z0-9-]+$')]


@router.get('/{slug}', summary='Experiment detail', dependencies=[DependsJwtAuth])
async def get_experiment(request: Request, slug: SlugPath) -> ResponseModel:
    data = await experiment_service.get_experiment(user_id=request.user.id, slug=slug)
    return response_base.success(request=request, data=ExperimentDetail(**data))


@router.post('/{slug}/start', summary='Start or resume an experiment', dependencies=[DependsJwtAuth])
async def start_experiment(request: Request, slug: SlugPath) -> ResponseModel:
    data = await experiment_service.start(user_id=request.user.id, slug=slug)
    return response_base.success(request=request, data=StartExperimentResult(**data))


@router.put(
    '/{slug}/state',
    summary='Autosave the bench state',
    dependencies=[DependsJwtAuth, Depends(RateLimiter(times=120, minutes=1))],
)
async def save_state(
    request: Request, slug: SlugPath, obj: SaveExperimentStateParam
) -> ResponseModel:
    data = await experiment_service.save_state(user_id=request.user.id, slug=slug, obj=obj)
    return response_base.success(request=request, data=data)


@router.post(
    '/{slug}/submit',
    summary='Submit answers and get graded',
    dependencies=[DependsJwtAuth, Depends(RateLimiter(times=30, minutes=1))],
)
async def submit_experiment(
    request: Request, slug: SlugPath, obj: SubmitExperimentParam
) -> ResponseModel:
    data = await experiment_service.submit(user_id=request.user.id, slug=slug, obj=obj)
    return response_base.success(request=request, data=SubmitExperimentResult(**data))


@router.get('/{slug}/progress', summary='My state on this experiment', dependencies=[DependsJwtAuth])
async def get_experiment_progress(request: Request, slug: SlugPath) -> ResponseModel:
    data = await experiment_service.get_progress(user_id=request.user.id, slug=slug)
    return response_base.success(request=request, data=data)
