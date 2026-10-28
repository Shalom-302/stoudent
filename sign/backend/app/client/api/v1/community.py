"""STOUDENT community: the question feed, answers, votes, resources, reports.

Reading is public - a student lands on a question from a shared link before
having an account. Writing requires a session.
"""
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, Path, Query, Request, UploadFile
from fastapi.responses import Response
from fastapi_limiter.depends import RateLimiter

from backend.app.client.schema.community import (
    CreateAnswerParam,
    CreateQuestionParam,
    CreateReportParam,
    CreateResourceParam,
    MarkReadParam,
    NotificationDetail,
    QuestionDetail,
    QuestionSummary,
    ResourceDetail,
    VoteParam,
)
from backend.app.client.service.community_service import community_service
from backend.app.client.service.upload_service import read_image, store_image
from backend.common.enums import Role as RoleEnum
from backend.common.exception import errors
from backend.core.conf import settings
from backend.common.response.response_schema import ResponseModel, response_base
from backend.common.security.jwt import DependsJwtAuth
from backend.common.security.roles import require_roles
from starlette.concurrency import run_in_threadpool

router = APIRouter(prefix='/community', tags=['Community'])

XIdPath = Annotated[str, Path(min_length=8, max_length=32, pattern=r'^[a-z0-9]+$')]
Text = Annotated[str | None, Query(max_length=100)]


def _resources_open() -> None:
    if not settings.COMMUNITY_RESOURCES_ENABLED:
        raise errors.NotFoundError(msg='Les ressources ne sont pas encore ouvertes.')


def _viewer_id(request: Request) -> int | None:
    return getattr(request.user, 'id', None)


@router.get('/meta', summary='Feed filters: filières, matières, popular tags, counters')
async def meta(request: Request) -> ResponseModel:
    return response_base.success(request=request, data=await community_service.meta())


@router.get('/questions', summary='Question feed')
async def list_questions(
    request: Request,
    filiere: Text = None,
    subject: Text = None,
    tag: Annotated[str | None, Query(max_length=40)] = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    sort: Literal['recent', 'votes', 'active', 'unanswered'] = 'recent',
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=50)] = 20,
) -> ResponseModel:
    data = await community_service.list_questions(
        filiere=filiere, subject=subject, tag=tag, q=q, sort=sort, page=page, size=size
    )
    data['items'] = [QuestionSummary(**item) for item in data['items']]
    return response_base.success(request=request, data=data)


@router.post(
    '/questions',
    summary='Ask a question',
    dependencies=[DependsJwtAuth, Depends(RateLimiter(times=10, hours=1))],
)
async def create_question(request: Request, obj: CreateQuestionParam) -> ResponseModel:
    data = await community_service.create_question(user_id=request.user.id, obj=obj)
    return response_base.success(request=request, data=data)


@router.get('/questions/{x_id}', summary='A question with its answers')
async def get_question(request: Request, x_id: XIdPath) -> ResponseModel:
    data = await community_service.get_question(
        x_id=x_id, viewer_id=_viewer_id(request), viewer_ip=getattr(request.state, 'ip', None) or 'unknown'
    )
    return response_base.success(request=request, data=QuestionDetail(**data))


@router.delete('/questions/{x_id}', summary='Delete my unanswered question', dependencies=[DependsJwtAuth])
async def delete_question(request: Request, x_id: XIdPath) -> ResponseModel:
    await community_service.delete_question(x_id=x_id, user_id=request.user.id)
    return response_base.success(request=request)


@router.post(
    '/questions/{x_id}/answers',
    summary='Answer a question',
    dependencies=[DependsJwtAuth, Depends(RateLimiter(times=30, hours=1))],
)
async def create_answer(
    request: Request, x_id: XIdPath, obj: CreateAnswerParam, background: BackgroundTasks
) -> ResponseModel:
    data = await community_service.create_answer(
        question_x_id=x_id, user_id=request.user.id, obj=obj, background=background
    )
    return response_base.success(request=request, data=data)


@router.post(
    '/questions/{x_id}/accept/{answer_x_id}',
    summary='Mark (or unmark) the accepted answer',
    dependencies=[DependsJwtAuth],
)
async def accept_answer(request: Request, x_id: XIdPath, answer_x_id: XIdPath) -> ResponseModel:
    await community_service.accept_answer(question_x_id=x_id, answer_x_id=answer_x_id, user_id=request.user.id)
    return response_base.success(request=request)


@router.post(
    '/answers/{x_id}/endorse',
    summary='Teacher: toggle "validée par un professeur"',
    dependencies=[DependsJwtAuth, Depends(require_roles(RoleEnum.TEACHER.value, RoleEnum.ADMIN.value))],
)
async def endorse_answer(request: Request, x_id: XIdPath) -> ResponseModel:
    data = await community_service.endorse_answer(answer_x_id=x_id, user_id=request.user.id)
    return response_base.success(request=request, data=data)


@router.patch('/questions/{x_id}', summary='Edit my question', dependencies=[DependsJwtAuth])
async def edit_question(request: Request, x_id: XIdPath, obj: CreateQuestionParam) -> ResponseModel:
    await community_service.edit_question(x_id=x_id, user_id=request.user.id, obj=obj)
    return response_base.success(request=request)


@router.patch('/answers/{x_id}', summary='Edit my answer', dependencies=[DependsJwtAuth])
async def edit_answer(request: Request, x_id: XIdPath, obj: CreateAnswerParam) -> ResponseModel:
    await community_service.edit_answer(answer_x_id=x_id, user_id=request.user.id, obj=obj)
    return response_base.success(request=request)


@router.delete('/answers/{x_id}', summary='Delete my answer', dependencies=[DependsJwtAuth])
async def delete_answer(request: Request, x_id: XIdPath) -> ResponseModel:
    await community_service.delete_answer(answer_x_id=x_id, user_id=request.user.id)
    return response_base.success(request=request)


@router.post(
    '/answers/{x_id}/thanks',
    summary='Toggle "Merci" on an answer',
    dependencies=[DependsJwtAuth, Depends(RateLimiter(times=60, minutes=10))],
)
async def thank_answer(request: Request, x_id: XIdPath) -> ResponseModel:
    data = await community_service.thank_answer(answer_x_id=x_id, user_id=request.user.id)
    return response_base.success(request=request, data=data)


@router.get('/notifications', summary='My notifications', dependencies=[DependsJwtAuth])
async def list_notifications(
    request: Request, limit: Annotated[int, Query(ge=1, le=50)] = 20
) -> ResponseModel:
    data = await community_service.list_notifications(user_id=request.user.id, limit=limit)
    data['items'] = [NotificationDetail(**item) for item in data['items']]
    return response_base.success(request=request, data=data)


@router.post('/notifications/read', summary='Mark notifications read', dependencies=[DependsJwtAuth])
async def mark_read(request: Request, obj: MarkReadParam) -> ResponseModel:
    await community_service.mark_read(user_id=request.user.id, x_ids=obj.x_ids)
    return response_base.success(request=request)


@router.post(
    '/uploads',
    summary='Upload a photo of an exercise statement',
    dependencies=[DependsJwtAuth, Depends(RateLimiter(times=20, hours=1))],
)
async def upload_image(request: Request, file: UploadFile = File(...)) -> ResponseModel:
    # Read one byte past the cap so an oversized file is refused without
    # pulling the whole body into memory.
    raw = await file.read(settings.UPLOAD_MAX_BYTES + 1)
    url = await run_in_threadpool(store_image, raw)
    return response_base.success(request=request, data={'image_url': url})


@router.get('/uploads/{name}', summary='A photo attached to a question')
async def get_image(name: Annotated[str, Path(max_length=40)]) -> Response:
    data = await run_in_threadpool(read_image, name)
    # Names are random and never reused: cache for a year.
    return Response(
        content=data,
        media_type='image/jpeg',
        headers={'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff'},
    )


@router.post(
    '/votes',
    summary='Vote on a question or an answer (+1, -1, or 0 to withdraw)',
    dependencies=[DependsJwtAuth, Depends(RateLimiter(times=60, minutes=10))],
)
async def vote(request: Request, obj: VoteParam) -> ResponseModel:
    data = await community_service.vote(user_id=request.user.id, obj=obj)
    return response_base.success(request=request, data=data)


Kind = Literal['sujet', 'corrige', 'cours', 'td', 'autre']


@router.get('/resources/facets', summary='Library filters with counts', dependencies=[Depends(_resources_open)])
async def resource_facets(
    request: Request,
    filiere: Text = None,
    subject: Text = None,
    kind: Kind | None = None,
) -> ResponseModel:
    data = await community_service.resource_facets(filiere=filiere, subject=subject, kind=kind)
    return response_base.success(request=request, data=data)


@router.get('/resources', summary='Library: sujets, corrigés, cours, TD', dependencies=[Depends(_resources_open)])
async def list_resources(
    request: Request,
    filiere: Text = None,
    subject: Text = None,
    kind: Kind | None = None,
    year: Annotated[int | None, Query(ge=1990, le=2100)] = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    sort: Literal['recent', 'popular', 'subject'] = 'recent',
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=50)] = 20,
) -> ResponseModel:
    data = await community_service.list_resources(
        filiere=filiere, subject=subject, kind=kind, year=year, q=q, sort=sort, page=page, size=size
    )
    data['items'] = [ResourceDetail(**item) for item in data['items']]
    return response_base.success(request=request, data=data)


@router.post(
    '/resources/{x_id}/open',
    summary='Count a visit to the original document',
    dependencies=[Depends(_resources_open), Depends(RateLimiter(times=120, minutes=10))],
)
async def open_resource(request: Request, x_id: XIdPath) -> ResponseModel:
    data = await community_service.open_resource(x_id=x_id)
    return response_base.success(request=request, data=data)


@router.post(
    '/resources',
    summary='Suggest a link (listed once an admin approves it)',
    dependencies=[Depends(_resources_open), DependsJwtAuth, Depends(RateLimiter(times=10, hours=1))],
)
async def create_resource(request: Request, obj: CreateResourceParam) -> ResponseModel:
    data = await community_service.create_resource(user_id=request.user.id, obj=obj)
    return response_base.success(request=request, data=data)


@router.post(
    '/reports',
    summary='Report a question, an answer or a resource',
    dependencies=[DependsJwtAuth, Depends(RateLimiter(times=20, hours=1))],
)
async def report(request: Request, obj: CreateReportParam) -> ResponseModel:
    data = await community_service.report(user_id=request.user.id, obj=obj)
    return response_base.success(request=request, data=data)
