"""Notifications: in-app always; one WhatsApp message per question, at most.

In-app rows cover everything (answers, accepted answer, teacher validation,
"Merci"). WhatsApp is deliberately sparse so it never reads as spam: a single
short message, "someone answered your question", sent when the FIRST answer
arrives, to members who opted in. Later answers, and every other event, stay
in the site's bell. Each question is marked once notified, in the database, so
no restart or retry can send it twice.

The message goes out as a background task after the commit, so a slow or
failing gowa never delays nor breaks posting an answer. An hourly cap per
member is kept as a last guard against the gowa number being banned.
"""
from sqlalchemy import select, update

from backend.app.client.service.otp_service import _send_to_any
from backend.common.log import log
from backend.core.conf import settings
from backend.database.db_postgres import async_db_session
from backend.database.db_redis import redis_client
from backend.models import StudentProfile, User
from backend.models.community import Notification, Question
from backend.utils.timezone import timezone


def add_notification(db, *, user_id: int, kind: str, question: Question, actor: User) -> bool:
    """Queue the in-app notification. False when the member acted on their own post."""
    if user_id == actor.id:
        return False
    db.add(
        Notification(
            user_id=user_id,
            kind=kind,
            question_id=question.id,
            actor=actor.pseudo or 'Un membre',
        )
    )
    return True


async def _under_hourly_cap(user_id: int) -> bool:
    key = f'stoudent:wa:h:{user_id}'
    try:
        count = await redis_client.incr(key)
        if count == 1:
            await redis_client.expire(key, 3600)
        return count <= settings.WHATSAPP_NOTIFY_MAX_PER_HOUR
    except Exception as exc:  # noqa: BLE001 - no Redis, no unthrottled sending
        log.warning(f'whatsapp notify throttle unavailable: {exc}')
        return False


async def notify_first_answer(*, user_id: int, question_x_id: str, title: str) -> None:
    """Background task: "someone answered your question", once per question."""
    if not settings.GOWA_URL or not settings.WHATSAPP_NOTIFY_ENABLED:
        return
    async with async_db_session.begin() as db:
        row = (
            await db.execute(
                select(User.phone, User.status, StudentProfile.whatsapp_opt_in)
                .join(StudentProfile, StudentProfile.user_id == User.id)
                .where(User.id == user_id)
            )
        ).first()
        if not row or not row.phone or not row.status or not row.whatsapp_opt_in:
            return
        # Claim the question atomically: two answers posted at the same time
        # still produce a single message.
        claimed = (
            await db.execute(
                update(Question)
                .where(Question.x_id == question_x_id, Question.answer_notified_at.is_(None))
                .values(answer_notified_at=timezone.now())
                .returning(Question.id)
            )
        ).first()
    if not claimed or not await _under_hourly_cap(user_id):
        return

    short = title if len(title) <= 70 else title[:67].rstrip() + '…'
    text = f'STOUDENT : quelqu’un a répondu à ta question « {short} ».'
    if settings.SITE_URL:
        text += f'\n{settings.SITE_URL.rstrip("/")}/questions/{question_x_id}'
    try:
        await _send_to_any(row.phone, text)
    except Exception as exc:  # noqa: BLE001 - a notification must never surface as an error
        log.warning(f'whatsapp notify failed for user {user_id}: {exc}')
