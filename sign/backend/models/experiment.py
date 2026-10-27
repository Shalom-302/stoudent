"""Experiment: one guided TP inside a lab."""
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.common.enums import DifficultyType
from backend.common.model import Base, get_id, id_key


class Experiment(Base):
    """A pedagogical unit: objective, theory, initial parameters, validation.

    ``validation_rules`` drives the server-side grading (see
    ``experiment_service.submit``) so the expected answers never reach the
    browser.
    """

    __tablename__ = 'experiment'

    id: Mapped[id_key] = mapped_column(init=False)
    x_id: Mapped[str] = mapped_column(sa.String(32), init=False, unique=True, default=get_id)
    lab_id: Mapped[int] = mapped_column(sa.ForeignKey('lab.id', ondelete='CASCADE'), index=True)
    title: Mapped[str] = mapped_column(sa.String(200))
    slug: Mapped[str] = mapped_column(sa.String(200), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(sa.Text, init=False, default=None)
    objective: Mapped[str | None] = mapped_column(sa.Text, init=False, default=None)
    difficulty: Mapped[str] = mapped_column(
        sa.String(30), init=False, default=DifficultyType.beginner.value
    )
    duration_minutes: Mapped[int] = mapped_column(sa.Integer, init=False, default=20)
    # Ordered steps: [{"title": ..., "content": ..., "hint": ...}]
    instructions: Mapped[list] = mapped_column(JSONB, init=False, default_factory=list)
    # Markdown / LaTeX shown *after* the manipulation: the synthesis.
    theory: Mapped[str | None] = mapped_column(sa.Text, init=False, default=None)
    # Course material available from the start: the formula the student needs,
    # plus a fully worked example. A TP is practice, and practice without the
    # formula in hand is guesswork - the student solves on paper, then checks
    # the answer on the instrument.
    # {"formula", "formula_note", "example": [{"title", "text", "result"}],
    #  "your_turn"}
    guide: Mapped[dict] = mapped_column(JSONB, init=False, default_factory=dict)
    initial_parameters: Mapped[dict] = mapped_column(JSONB, init=False, default_factory=dict)
    # [{"id", "type", "question", "options", "answer", "tolerance", "points"}]
    validation_rules: Mapped[list] = mapped_column(JSONB, init=False, default_factory=list)
    xp_reward: Mapped[int] = mapped_column(sa.Integer, init=False, default=100)
    order: Mapped[int] = mapped_column(sa.Integer, init=False, default=0)
    is_published: Mapped[bool] = mapped_column(sa.Boolean, init=False, default=True)

    lab: Mapped['Lab'] = relationship(init=False, back_populates='experiments', lazy='joined')
