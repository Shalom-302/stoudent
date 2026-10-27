"""StudentExperiment: the per-student, resumable state of one TP."""
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.common.enums import ExperimentStatusType
from backend.common.model import Base, get_id, id_key


class StudentExperiment(Base):
    """Saved lab state so a student returns to exactly where they stopped.

    ``parameters`` mirrors the instrument panel (frequency, sampling rate,
    filter...), which is also the context the future AI Tutor will receive.
    """

    __tablename__ = 'student_experiment'
    __table_args__ = (
        sa.UniqueConstraint('student_id', 'experiment_id', name='uq_student_experiment'),
    )

    id: Mapped[id_key] = mapped_column(init=False)
    x_id: Mapped[str] = mapped_column(sa.String(32), init=False, unique=True, default=get_id)
    student_id: Mapped[int] = mapped_column(
        sa.ForeignKey('student_profile.id', ondelete='CASCADE'), index=True
    )
    experiment_id: Mapped[int] = mapped_column(
        sa.ForeignKey('experiment.id', ondelete='CASCADE'), index=True
    )
    status: Mapped[str] = mapped_column(
        sa.String(30), init=False, default=ExperimentStatusType.not_started.value
    )
    progress: Mapped[int] = mapped_column(sa.Integer, init=False, default=0)  # 0..100
    current_step: Mapped[int] = mapped_column(sa.Integer, init=False, default=0)
    parameters: Mapped[dict] = mapped_column(JSONB, init=False, default_factory=dict)
    answers: Mapped[dict] = mapped_column(JSONB, init=False, default_factory=dict)
    # Manipulations the student has actually performed, latched as they happen.
    # A TP is graded on what was done at the bench, so this has to survive the
    # student moving a knob back: reaching a state once is the achievement.
    milestones: Mapped[list] = mapped_column(JSONB, init=False, default_factory=list)
    score: Mapped[int] = mapped_column(sa.Integer, init=False, default=0)  # 0..100
    best_score: Mapped[int] = mapped_column(sa.Integer, init=False, default=0)
    xp_earned: Mapped[int] = mapped_column(sa.Integer, init=False, default=0)
    attempts: Mapped[int] = mapped_column(sa.Integer, init=False, default=0)
    started_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), init=False, default=None
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), init=False, default=None
    )

    experiment: Mapped['Experiment'] = relationship(init=False, lazy='joined')
