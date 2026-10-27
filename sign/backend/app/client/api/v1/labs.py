"""Lab catalogue and the 3D world descriptor."""
from typing import Annotated

from fastapi import APIRouter, Path, Request

from backend.app.client.schema.lab import ExperimentSummary, LabDetail, LabSummary
from backend.app.client.service.lab_service import lab_service
from backend.common.response.response_schema import ResponseModel, response_base
from backend.common.security.jwt import DependsJwtAuth

router = APIRouter(prefix='/labs', tags=['Labs'])

# Slugs come from our own seed data; constrain the path anyway so the parameter
# can never be used to probe the API with arbitrary strings.
SlugPath = Annotated[str, Path(min_length=2, max_length=150, pattern=r'^[a-z0-9-]+$')]


@router.get('', summary='List the laboratories', dependencies=[DependsJwtAuth])
async def get_labs(request: Request) -> ResponseModel:
    data = await lab_service.get_labs(user_id=request.user.id)
    return response_base.success(request=request, data=[LabSummary(**item) for item in data])


@router.get('/world', summary='World scene descriptor', dependencies=[DependsJwtAuth])
async def get_world(request: Request) -> ResponseModel:
    """Buildings plus the avatar's saved transform, in one round trip."""
    data = await lab_service.get_world(user_id=request.user.id)
    return response_base.success(request=request, data=data)


@router.get('/{slug}', summary='Lab detail', dependencies=[DependsJwtAuth])
async def get_lab(request: Request, slug: SlugPath) -> ResponseModel:
    data = await lab_service.get_lab(user_id=request.user.id, slug=slug)
    return response_base.success(request=request, data=LabDetail(**data))


@router.get('/{slug}/experiments', summary='Experiments of a lab', dependencies=[DependsJwtAuth])
async def get_lab_experiments(request: Request, slug: SlugPath) -> ResponseModel:
    data = await lab_service.get_lab_experiments(user_id=request.user.id, slug=slug)
    return response_base.success(
        request=request, data=[ExperimentSummary(**item) for item in data]
    )
