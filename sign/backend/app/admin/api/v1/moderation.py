"""STOUDENT moderation, inside SignManager: the report queue and visibility.

Admin-only, guarded by role like the rest of the back-office.
"""
from typing import Annotated, Literal

from fastapi import APIRouter, Path, Query, Request
from pydantic import Field
from sqlalchemy import func, select

from backend.common.exception import errors
from backend.common.response.response_schema import ResponseModel, response_base
from backend.common.schema import SchemaBase
from backend.common.security.jwt import DependsJwtAuth
from backend.common.security.roles import DependsAdmin
from backend.database.db_postgres import async_db_session
from backend.models import User
from backend.app.client.service.community_service import _comment_count_changed
from backend.models.community import Answer, Comment, Question, Report, Resource

router = APIRouter(prefix='/moderation', tags=['Moderation'])

XIdPath = Annotated[str, Path(min_length=8, max_length=32, pattern=r'^[a-z0-9]+$')]
TargetType = Literal['question', 'answer', 'resource', 'comment']
_MODELS = {'question': Question, 'answer': Answer, 'resource': Resource, 'comment': Comment}


class ResolveReportParam(SchemaBase):
    # 'hide' hides the content; 'restore' and 'dismiss' make it visible again,
    # 'dismiss' also recording the reports as unfounded.
    action: Literal['hide', 'restore', 'dismiss']
    note: str | None = Field(default=None, max_length=300)


def _preview(target) -> tuple[str, str | None]:
    """(text shown in the queue, question x_id to link to)."""
    if isinstance(target, Question):
        return target.title, target.x_id
    if isinstance(target, (Answer, Comment)):
        return ' '.join(target.body.split())[:200], None
    return f'{target.title} — {target.url}', None


@router.get('/reports', summary='Report queue, grouped by content', dependencies=[DependsJwtAuth, DependsAdmin])
async def list_reports(
    request: Request,
    status: Literal['open', 'resolved', 'dismissed'] = 'open',
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ResponseModel:
    async with async_db_session() as db:
        grouped = (
            select(
                Report.target_type,
                Report.target_id,
                func.count(Report.id).label('count'),
                func.array_agg(Report.reason).label('reasons'),
                func.max(Report.created_time).label('last_time'),
            )
            .where(Report.status == status)
            .group_by(Report.target_type, Report.target_id)
        )
        total = (await db.execute(select(func.count()).select_from(grouped.subquery()))).scalar_one()
        rows = (
            await db.execute(
                grouped.order_by(func.count(Report.id).desc(), func.max(Report.created_time).desc())
                .offset((page - 1) * size)
                .limit(size)
            )
        ).all()

        items = []
        for target_type, target_id, count, reasons, last_time in rows:
            target = await db.get(_MODELS[target_type], target_id)
            if target is None:
                continue
            author = await db.get(User, target.author_id)
            text, question_x_id = _preview(target)
            if isinstance(target, (Answer, Comment)):
                parent = await db.get(Question, target.question_id)
                question_x_id = parent.x_id if parent else None
            items.append(
                {
                    'target_type': target_type,
                    'target_x_id': target.x_id,
                    'question_x_id': question_x_id,
                    'preview': text,
                    'author': (author.pseudo or author.email or author.phone) if author else None,
                    'is_hidden': target.is_hidden,
                    'count': count,
                    'reasons': sorted(set(reasons)),
                    'last_time': last_time,
                }
            )
    return response_base.success(
        request=request,
        data={'items': items, 'total': int(total), 'page': page, 'size': size,
              'total_pages': (int(total) + size - 1) // size},
    )


@router.post(
    '/{target_type}/{x_id}/resolve',
    summary='Close every open report on a content, hiding or restoring it',
    dependencies=[DependsJwtAuth, DependsAdmin],
)
async def resolve(request: Request, target_type: TargetType, x_id: XIdPath, obj: ResolveReportParam) -> ResponseModel:
    model = _MODELS[target_type]
    async with async_db_session.begin() as db:
        target = (await db.execute(select(model).where(model.x_id == x_id))).unique().scalars().first()
        if target is None:
            raise errors.NotFoundError(msg='Contenu introuvable.')
        was_hidden = target.is_hidden
        if obj.action == 'hide':
            target.is_hidden = True
        else:
            # Restoring, or dismissing reports judged unfounded, undoes an
            # automatic hide triggered by those reports.
            target.is_hidden = False
        if isinstance(target, Comment) and was_hidden != target.is_hidden:
            # The counter under the post counts visible comments only.
            await _comment_count_changed(db, target, -1 if target.is_hidden else 1)
        reports = (
            await db.execute(
                select(Report).where(
                    Report.target_type == target_type, Report.target_id == target.id, Report.status == 'open'
                )
            )
        ).scalars().all()
        for report in reports:
            report.status = 'dismissed' if obj.action == 'dismiss' else 'resolved'
    return response_base.success(request=request, data={'is_hidden': target.is_hidden})


class ReviewResourceParam(SchemaBase):
    action: Literal['approve', 'reject']


@router.get(
    '/resources/pending',
    summary='Links suggested by members, waiting for review',
    dependencies=[DependsJwtAuth, DependsAdmin],
)
async def pending_resources(request: Request) -> ResponseModel:
    async with async_db_session() as db:
        rows = (
            await db.execute(
                select(Resource).where(Resource.status == 'pending').order_by(Resource.id.asc()).limit(100)
            )
        ).unique().scalars().all()
        items = [
            {
                'x_id': r.x_id,
                'title': r.title,
                'url': r.url,
                'filiere': r.filiere,
                'subject': r.subject,
                'kind': r.kind,
                'session_year': r.session_year,
                'source': r.source,
                'original_author': r.original_author,
                'description': r.description,
                'author': r.author.pseudo or r.author.email or r.author.phone,
                'created_time': r.created_time,
            }
            for r in rows
        ]
    return response_base.success(request=request, data={'items': items})


@router.post(
    '/resources/{x_id}/review',
    summary='Publish or reject a suggested link',
    dependencies=[DependsJwtAuth, DependsAdmin],
)
async def review_resource(request: Request, x_id: XIdPath, obj: ReviewResourceParam) -> ResponseModel:
    async with async_db_session.begin() as db:
        resource = (await db.execute(select(Resource).where(Resource.x_id == x_id))).unique().scalars().first()
        if resource is None:
            raise errors.NotFoundError(msg='Ressource introuvable.')
        resource.status = 'published' if obj.action == 'approve' else 'rejected'
    return response_base.success(request=request, data={'status': resource.status})
