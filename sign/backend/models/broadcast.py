"""WhatsApp announcements sent from SignManager to members who opted in."""
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from backend.common.model import Base, get_id, id_key


class Broadcast(Base):
    __tablename__ = 'broadcast'

    id: Mapped[id_key] = mapped_column(init=False)
    x_id: Mapped[str] = mapped_column(sa.String(32), init=False, unique=True, default=get_id)
    author_id: Mapped[int] = mapped_column(sa.ForeignKey('user.id', ondelete='CASCADE'), index=True)
    # The text exactly as members receive it.
    message: Mapped[str] = mapped_column(sa.Text)
    audience: Mapped[str] = mapped_column(sa.String(20))  # 'all' | 'filiere' | 'members'
    filiere: Mapped[str | None] = mapped_column(sa.String(100), default=None)
    recipients: Mapped[int] = mapped_column(sa.Integer, default=0)
    sent: Mapped[int] = mapped_column(sa.Integer, default=0, server_default='0')
    failed: Mapped[int] = mapped_column(sa.Integer, default=0, server_default='0')
    # 'queued' -> 'sending' -> 'done' | 'failed'
    status: Mapped[str] = mapped_column(sa.String(20), default='queued', server_default='queued', index=True)
    # Why it stopped early, shown in the history.
    error: Mapped[str | None] = mapped_column(sa.String(300), default=None)
    finished_time: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), default=None)
