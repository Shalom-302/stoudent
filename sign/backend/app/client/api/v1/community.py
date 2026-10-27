"""STOUDENT community: the question feed, answers, votes, resources, reports.

Reading is public - a student lands on a question from a shared link before
having an account. Writing requires a session.
"""
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi_limiter.depends import RateLimiter

from backend.app.client.schema.community import (
    CreateAnswerParam,
    CreateQuestionParam,
    CreateReportParam,
    CreateResourceParam,
    QuestionDetail,
    QuestionSummary,
    ResourceDetail,
    VoteParam,
)
from backend.app.client.service.community_service import community_service
from backend.common.enums import Role as RoleEnum
from backend.common.response.response_schema import ResponseModel, response_base
from backend.common.security.jwt import DependsJwtAuth
from backend.common.security.roles import require_roles

router = APIRouter(prefix='/community', tags=['Community'])

XIdPath = Annotated[str, Path(min_length=8, max_length=32, pattern=r'^[a-z0-9]+$')]
Text = Annotated[str | None, Query(max_length=100)]


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
async def create_answer(request: Request, x_id: XIdPath, obj: CreateAnswerParam) -> ResponseModel:
    data = await community_service.create_answer(question_x_id=x_id, user_id=request.user.id, obj=obj)
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
    data = await community_service.endorse_answer(answer_x_id=x_id)
    return response_base.success(request=request, data=data)


@router.post(
    '/votes',
    summary='Vote on a question or an answer (+1, -1, or 0 to withdraw)',
    dependencies=[DependsJwtAuth, Depends(RateLimiter(times=60, minutes=10))],
)
async def vote(request: Request, obj: VoteParam) -> ResponseModel:
    data = await community_service.vote(user_id=request.user.id, obj=obj)
    return response_base.success(request=request, data=data)


@router.get('/resources', summary='Shared learning resources')
async def list_resources(
    request: Request,
    filiere: Text = None,
    subject: Text = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=50)] = 20,
) -> ResponseModel:
    data = await community_service.list_resources(filiere=filiere, subject=subject, q=q, page=page, size=size)
    data['items'] = [ResourceDetail(**item) for item in data['items']]
    return response_base.success(request=request, data=data)


@router.post(
    '/resources',
    summary='Share a resource link',
    dependencies=[DependsJwtAuth, Depends(RateLimiter(times=10, hours=1))],
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
