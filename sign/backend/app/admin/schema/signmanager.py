"""Schemas for the SignManager back-office."""
from datetime import datetime

from pydantic import ConfigDict, EmailStr, Field

from backend.common.schema import SchemaBase


class OverviewCounters(SchemaBase):
    """Headline numbers of the platform."""

    total_students: int
    active_students: int
    inactive_students: int
    # Students who validated at least one TP in the period.
    engaged_students: int
    total_experiments_completed: int
    total_xp_awarded: int
    average_score: int
    badges_unlocked: int


class ExperimentStat(SchemaBase):
    slug: str
    title: str
    lab_slug: str
    started: int
    completed: int
    completion_rate: int
    average_score: int
    average_attempts: float


class OverviewDetail(SchemaBase):
    counters: OverviewCounters
    experiments: list[ExperimentStat]


class ManagedStudent(SchemaBase):
    model_config = ConfigDict(from_attributes=True)

    x_id: str
    user_x_id: str
    email: EmailStr | None = None
    phone: str | None = None
    pseudo: str | None = None
    filiere: str | None = None
    member_type: str = 'student'
    reputation: int = 0
    firstname: str | None = None
    lastname: str | None = None
    institution: str | None = None
    level: str | None = None
    status: bool
    roles: list[str] = []
    total_xp: int
    level_number: int
    completed_experiments: int
    average_score: int
    badges: int
    join_time: datetime | None = None
    last_login_time: datetime | None = None


class ManagedStudentExperiment(SchemaBase):
    experiment_slug: str
    experiment_title: str
    lab_slug: str
    status: str
    progress: int
    score: int
    best_score: int
    xp_earned: int
    attempts: int
    started_at: datetime | None = None
    completed_at: datetime | None = None


class ManagedStudentDetail(ManagedStudent):
    bio: str | None = None
    experiments: list[ManagedStudentExperiment] = []
    achievements: list[str] = []


class UpdateStudentStatusParam(SchemaBase):
    status: bool = Field(description='False deactivates the account, True re-enables it.')


class UpdateStudentRolesParam(SchemaBase):
    roles: list[str] = Field(min_length=1, max_length=8)
