"""Student profile: the SignalLab identity layered on top of :class:`User`."""
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.common.model import Base, get_id, id_key


class StudentProfile(Base):
    """One-to-one extension of ``User`` holding everything MyLab needs.

    The ``User`` row stays the authentication identity; this table carries the
    pedagogical state (institution, level, XP) so the auth core stays generic.
    """

    __tablename__ = 'student_profile'

    id: Mapped[id_key] = mapped_column(init=False)
    x_id: Mapped[str] = mapped_column(sa.String(32), init=False, unique=True, default=get_id)
    user_id: Mapped[int] = mapped_column(
        sa.ForeignKey('user.id', ondelete='CASCADE'), unique=True, index=True
    )
    bio: Mapped[str | None] = mapped_column(sa.Text, init=False, default=None)
    institution: Mapped[str | None] = mapped_column(sa.String(200), init=False, default=None)
    # Free-form academic level, e.g. "BTS RIT 1" - not the gamification level.
    level: Mapped[str | None] = mapped_column(sa.String(100), init=False, default=None)
    # STOUDENT: the field of study (RIT, IDA, Télécoms...). Required at sign-up,
    # nullable only for the accounts created before it existed.
    filiere: Mapped[str | None] = mapped_column(sa.String(100), init=False, index=True, default=None)
    # What the member declared at sign-up: 'student' or 'teacher'. A declared
    # teacher is not trusted as such until an admin grants the 'teacher' role.
    member_type: Mapped[str] = mapped_column(
        sa.String(20), init=False, default='student', server_default='student'
    )
    # Community reputation, earned from votes and accepted answers.
    reputation: Mapped[int] = mapped_column(sa.Integer, init=False, default=0, server_default='0')
    total_xp: Mapped[int] = mapped_column(sa.Integer, init=False, default=0, server_default='0')
    level_number: Mapped[int] = mapped_column(sa.Integer, init=False, default=1, server_default='1')

    user: Mapped['User'] = relationship(init=False, lazy='joined')
    avatar: Mapped['Avatar'] = relationship(
        init=False,
        back_populates='student',
        lazy='joined',
        uselist=False,
        cascade='all, delete-orphan',
    )
