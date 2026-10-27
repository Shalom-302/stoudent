"""StudentAchievement: join row recording when a badge was unlocked."""
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql.functions import current_timestamp

from backend.common.model import Base, id_key


class StudentAchievement(Base):
    __tablename__ = 'student_achievement'
    __table_args__ = (
        sa.UniqueConstraint('student_id', 'achievement_id', name='uq_student_achievement'),
    )

    id: Mapped[id_key] = mapped_column(init=False)
    student_id: Mapped[int] = mapped_column(
        sa.ForeignKey('student_profile.id', ondelete='CASCADE'), index=True
    )
    achievement_id: Mapped[int] = mapped_column(
        sa.ForeignKey('achievement.id', ondelete='CASCADE'), index=True
    )
    unlocked_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), init=False, default=current_timestamp()
    )

    achievement: Mapped['Achievement'] = relationship(init=False, lazy='joined')
