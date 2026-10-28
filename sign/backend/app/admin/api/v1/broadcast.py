"""WhatsApp announcements from SignManager ("nouvelle mise à jour sur STOUDENT").

Only members who ticked the WhatsApp consent receive anything, whatever the
audience, even when an admin picks them one by one. Messages leave strictly one
after the other from a background task, with random gaps and regular breaks,
one announcement at a time, so the gowa number never sends in bursts
(WhatsApp bans numbers that do). See WHATSAPP_BROADCAST_* in core/conf.py.
"""
import asyncio
import random

from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Request
from pydantic import Field, HttpUrl, model_validator
from sqlalchemy import func, select

from backend.app.client.service.otp_service import _send_to_any
from backend.common.exception import errors
from backend.common.log import log
from backend.common.response.response_schema import ResponseModel, response_base
from backend.common.schema import SchemaBase
from backend.common.security.jwt import DependsJwtAuth
from backend.common.security.roles import DependsAdmin
from backend.core.conf import settings
from backend.database.db_postgres import async_db_session
from backend.models import StudentProfile, User
from backend.models.broadcast import Broadcast
from backend.utils.timezone import timezone

router = APIRouter(prefix='/broadcast', tags=['Broadcast'])

# Demo and library accounts use numbers no operator assigns.
RESERVED_PREFIX = '22500'
# A 'sending' row not touched for this long belongs to a process that died.
STALE_AFTER = timedelta(minutes=15)  # longer than any break between two messages


class BroadcastParam(SchemaBase):
    title: str = Field(min_length=3, max_length=80)
    message: str = Field(min_length=5, max_length=600)
    link: HttpUrl | str | None = Field(default=None, max_length=300)
    audience: Literal['all', 'filiere', 'members']
    filiere: str | None = Field(default=None, max_length=100)
    user_x_ids: list[str] = Field(default_factory=list, max_length=200)

    @model_validator(mode='after')
    def _audience_target(self):
        if self.audience == 'filiere' and not (self.filiere or '').strip():
            raise ValueError('Choisissez une filière.')
        if self.audience == 'members' and not self.user_x_ids:
            raise ValueError('Choisissez au moins un membre.')
        return self


def _site() -> str:
    return (settings.SITE_URL or '').rstrip('/')


def _render(obj: BroadcastParam) -> str:
    link = str(obj.link).strip() if obj.link else ''
    # A path like "/bibliotheque" becomes a full link to the site.
    if link.startswith('/') and _site():
        link = _site() + link
    parts = [f'STOUDENT · {obj.title.strip()}', obj.message.strip()]
    if link:
        parts.append(link)
    stop = f'{_site()}/profile' if _site() else 'ton profil STOUDENT'
    parts.append(f'Tu reçois ce message car tu as accepté les infos STOUDENT sur WhatsApp. Pour arrêter : {stop}')
    return '\n\n'.join(parts)


def _scope(obj: BroadcastParam):
    """Members the audience designates, consent aside."""
    stmt = (
        select(User.id, User.phone, StudentProfile.whatsapp_opt_in)
        .join(StudentProfile, StudentProfile.user_id == User.id)
        .where(User.status.is_(True), User.phone.is_not(None), ~User.phone.startswith(RESERVED_PREFIX))
    )
    if obj.audience == 'filiere':
        stmt = stmt.where(func.lower(StudentProfile.filiere) == obj.filiere.strip().lower())
    elif obj.audience == 'members':
        stmt = stmt.where(User.x_id.in_(obj.user_x_ids))
    return stmt


async def _audience(db, obj: BroadcastParam) -> tuple[list[tuple[int, str]], int]:
    rows = (await db.execute(_scope(obj))).all()
    consenting = [(r.id, r.phone) for r in rows if r.whatsapp_opt_in]
    return consenting, len(rows) - len(consenting)


async def _active(db) -> Broadcast | None:
    """The announcement still going out, if any (a dead process's row is closed)."""
    row = (
        await db.execute(select(Broadcast).where(Broadcast.status.in_(('queued', 'sending'))).order_by(Broadcast.id))
    ).scalars().first()
    if row is None:
        return None
    last = row.updated_time or row.created_time
    if timezone.now() - last > STALE_AFTER:
        row.status = 'failed'
        row.finished_time = timezone.now()
        return None
    return row


def _gap() -> float:
    return random.uniform(settings.WHATSAPP_BROADCAST_DELAY_MIN, settings.WHATSAPP_BROADCAST_DELAY_MAX)


def estimate_seconds(count: int) -> int:
    """Average time the announcement takes to go out, breaks included."""
    if count <= 1:
        return 0
    gaps = (count - 1) * (settings.WHATSAPP_BROADCAST_DELAY_MIN + settings.WHATSAPP_BROADCAST_DELAY_MAX) / 2
    pauses = (count - 1) // settings.WHATSAPP_BROADCAST_PAUSE_EVERY * sum(settings.WHATSAPP_BROADCAST_PAUSE_SECONDS) / 2
    return int(gaps + pauses)


async def _deliver(broadcast_id: int, phones: list[str], text: str) -> None:
    """Background task: strictly one message after the other, never in parallel.

    Random gap between messages, a long break every few dozen, and a stop when
    gowa keeps failing (the number may be blocked: insisting would make it worse).
    """
    async with async_db_session.begin() as db:
        row = await db.get(Broadcast, broadcast_id)
        row.status = 'sending'
    sent = failed = streak = 0
    error = None
    for i, phone in enumerate(phones):
        try:
            await _send_to_any(phone, text)
            sent += 1
            streak = 0
        except Exception as exc:  # noqa: BLE001 - one unreachable number must not stop the rest
            failed += 1
            streak += 1
            log.warning(f'broadcast {broadcast_id}: send failed: {exc}')
            if streak >= settings.WHATSAPP_BROADCAST_MAX_CONSECUTIVE_FAILURES:
                error = (
                    f'Arrêté après {streak} échecs d’affilée (dernier : {str(exc)[:150]}). '
                    'Vérifiez que le numéro gowa est connecté avant de relancer.'
                )
        last = i == len(phones) - 1
        async with async_db_session.begin() as db:
            row = await db.get(Broadcast, broadcast_id)
            row.sent, row.failed = sent, failed
            if error or last:
                row.status = 'failed' if error or not sent else 'done'
                row.error = error
                row.finished_time = timezone.now()
        if error or last:
            return
        done = i + 1
        if done % settings.WHATSAPP_BROADCAST_PAUSE_EVERY == 0:
            await asyncio.sleep(random.uniform(*settings.WHATSAPP_BROADCAST_PAUSE_SECONDS))
        else:
            await asyncio.sleep(_gap())


def _item(b: Broadcast, author: str | None) -> dict:
    return {
        'x_id': b.x_id,
        'message': b.message,
        'audience': b.audience,
        'filiere': b.filiere,
        'recipients': b.recipients,
        'sent': b.sent,
        'failed': b.failed,
        'status': b.status,
        'error': b.error,
        'author': author,
        'created_time': b.created_time,
        'finished_time': b.finished_time,
    }


@router.post('/preview', summary='Who would receive the announcement, and the text', dependencies=[DependsJwtAuth, DependsAdmin])
async def preview(request: Request, obj: BroadcastParam) -> ResponseModel:
    async with async_db_session() as db:
        consenting, excluded = await _audience(db, obj)
    return response_base.success(
        request=request,
        data={
            'recipients': min(len(consenting), settings.WHATSAPP_BROADCAST_MAX_RECIPIENTS),
            'consenting': len(consenting),
            'excluded': excluded,
            'max_recipients': settings.WHATSAPP_BROADCAST_MAX_RECIPIENTS,
            'text': _render(obj),
            'estimated_seconds': estimate_seconds(min(len(consenting), settings.WHATSAPP_BROADCAST_MAX_RECIPIENTS)),
            'gowa_ready': bool(settings.GOWA_URL),
        },
    )


@router.post('', summary='Send a WhatsApp announcement to opted-in members', dependencies=[DependsJwtAuth, DependsAdmin])
async def send(request: Request, obj: BroadcastParam, background_tasks: BackgroundTasks) -> ResponseModel:
    if not settings.GOWA_URL:
        raise errors.ForbiddenError(msg='WhatsApp (gowa) n’est pas configuré sur ce serveur : GOWA_URL est vide.')
    text = _render(obj)
    async with async_db_session.begin() as db:
        active = await _active(db)
        if active is not None:
            raise errors.ForbiddenError(
                msg=f'Un envoi est déjà en cours ({active.sent + active.failed}/{active.recipients}). '
                'Attendez qu’il se termine.'
            )
        consenting, _ = await _audience(db, obj)
        if not consenting:
            raise errors.ForbiddenError(msg='Aucun destinataire : aucun membre de cette audience n’a donné son accord.')
        phones = [phone for _, phone in consenting][: settings.WHATSAPP_BROADCAST_MAX_RECIPIENTS]
        broadcast = Broadcast(
            author_id=request.user.id,
            message=text,
            audience=obj.audience,
            filiere=obj.filiere.strip() if obj.audience == 'filiere' and obj.filiere else None,
            recipients=len(phones),
        )
        db.add(broadcast)
        await db.flush()
        broadcast_id, x_id = broadcast.id, broadcast.x_id
    background_tasks.add_task(_deliver, broadcast_id, phones, text)
    return response_base.success(
        request=request,
        data={'x_id': x_id, 'recipients': len(phones), 'estimated_seconds': estimate_seconds(len(phones))},
    )


@router.get('', summary='Last announcements, with their progress', dependencies=[DependsJwtAuth, DependsAdmin])
async def history(request: Request) -> ResponseModel:
    async with async_db_session() as db:
        rows = (
            await db.execute(
                select(Broadcast, User.pseudo, User.email)
                .join(User, User.id == Broadcast.author_id, isouter=True)
                .order_by(Broadcast.id.desc())
                .limit(20)
            )
        ).all()
    return response_base.success(
        request=request, data={'items': [_item(b, pseudo or email) for b, pseudo, email in rows]}
    )
