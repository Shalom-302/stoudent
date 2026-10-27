"""Schemas for labs and experiments as the student sees them."""
from datetime import datetime

from pydantic import ConfigDict, Field

from backend.common.enums import ExperimentStatusType
from backend.common.schema import SchemaBase


class ExperimentSummary(SchemaBase):
    model_config = ConfigDict(from_attributes=True)

    x_id: str
    slug: str
    title: str
    description: str | None = None
    difficulty: str
    duration_minutes: int
    xp_reward: int
    order: int
    # Per-student overlay, filled by the service (not columns of Experiment).
    status: str = ExperimentStatusType.not_started.value
    progress: int = 0
    best_score: int = 0
    is_locked: bool = False


class Milestone(SchemaBase):
    """One manipulation the TP expects, and whether it has been done.

    The condition that unlocks it stays on the server; the student sees the
    instruction and the tick, never the threshold.
    """

    id: str
    label: str
    points: int
    done: bool


class GuideStep(SchemaBase):
    title: str
    text: str
    result: str | None = None


class Guide(SchemaBase):
    """Course material handed to the student before they touch the bench.

    The formula and a fully worked example: a TP is practice, and practice
    without the formula in hand is guesswork. The student solves on paper, then
    checks the answer on the instrument.
    """

    formula: str | None = None
    formula_note: str | None = None
    example: list[GuideStep] = []
    your_turn: str | None = None


class ScoreBreakdown(SchemaBase):
    manipulation: int
    manipulation_total: int
    reading: int
    reading_total: int


class ExperimentDetail(ExperimentSummary):
    """Full TP payload.

    ``validation_rules`` is deliberately absent: the expected answers stay on
    the server so a student cannot read them out of the network tab.
    """

    objective: str | None = None
    instructions: list = []
    guide: Guide | None = None
    theory: str | None = None
    initial_parameters: dict = {}
    lab_slug: str
    # Resumed state, so the browser reopens the bench exactly as it was left.
    current_step: int = 0
    parameters: dict = {}
    attempts: int = 0
    questions: list = []
    milestones: list[Milestone] = []


class LabSummary(SchemaBase):
    model_config = ConfigDict(from_attributes=True)

    x_id: str
    name: str
    slug: str
    type: str
    status: str
    description: str | None = None
    thumbnail: str | None = None
    order: int
    total_experiments: int = 0
    completed_experiments: int = 0
    progress_percent: int = 0


class LabDetail(LabSummary):
    scene_config: dict = {}
    experiments: list[ExperimentSummary] = []


class StartExperimentResult(SchemaBase):
    x_id: str
    status: str
    current_step: int
    parameters: dict
    attempts: int
    started_at: datetime | None = None
    milestones: list[Milestone] = []


class SaveExperimentStateParam(SchemaBase):
    """Autosave from the bench - cheap, frequent, never graded."""

    current_step: int | None = Field(default=None, ge=0, le=100)
    parameters: dict | None = None
    progress: int | None = Field(default=None, ge=0, le=100)


class SubmitExperimentParam(SchemaBase):
    """Answers to the validation questions of the TP."""

    answers: dict = Field(default_factory=dict)
    parameters: dict = Field(default_factory=dict)


class AnswerResult(SchemaBase):
    question_id: str
    correct: bool
    points: int
    max_points: int
    feedback: str | None = None


class UnlockedAchievement(SchemaBase):
    slug: str
    name: str
    icon: str
    xp_reward: int


class SubmitExperimentResult(SchemaBase):
    """Everything the result screen needs, computed server-side."""

    passed: bool
    score: int
    best_score: int
    xp_earned: int
    total_xp: int
    level_number: int
    level_up: bool
    attempts: int
    status: str
    results: list[AnswerResult]
    milestones: list[Milestone] = []
    breakdown: ScoreBreakdown | None = None
    unlocked_achievements: list[UnlockedAchievement] = []
    theory: str | None = None
