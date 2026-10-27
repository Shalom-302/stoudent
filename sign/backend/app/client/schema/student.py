"""Schemas for the student profile, MyLab and progression."""
from datetime import datetime

from pydantic import ConfigDict, EmailStr, Field, field_validator

from backend.common.schema import SchemaBase


class StudentProfileBase(SchemaBase):
    bio: str | None = Field(default=None, max_length=1000)
    institution: str | None = Field(default=None, max_length=200)
    level: str | None = Field(default=None, max_length=100)
    filiere: str | None = Field(default=None, min_length=2, max_length=100)

    @field_validator('filiere', mode='before')
    @classmethod
    def _blank_is_none(cls, v):
        # A cleared form field arrives as '' - store it as "not set".
        return (v.strip() or None) if isinstance(v, str) else v


class UpdateStudentProfileParam(StudentProfileBase):
    """PATCH body: identity fields live on ``User``, the rest on the profile."""

    firstname: str | None = Field(default=None, max_length=100)
    lastname: str | None = Field(default=None, max_length=100)


class AvatarDetail(SchemaBase):
    model_config = ConfigDict(from_attributes=True)

    x_id: str
    model: str
    skin: str
    hair: str
    outfit: str
    accessories: list = []
    position_x: float
    position_y: float
    position_z: float
    rotation: float


class UpsertAvatarParam(SchemaBase):
    model: str | None = Field(default=None, max_length=100)
    skin: str | None = Field(default=None, max_length=50)
    hair: str | None = Field(default=None, max_length=50)
    outfit: str | None = Field(default=None, max_length=50)
    accessories: list[str] | None = None


class AvatarTransformParam(SchemaBase):
    """Position saved when the student leaves the world."""

    position_x: float = Field(default=0.0, ge=-10_000, le=10_000)
    position_y: float = Field(default=0.0, ge=-10_000, le=10_000)
    position_z: float = Field(default=0.0, ge=-10_000, le=10_000)
    rotation: float = Field(default=0.0, ge=-100, le=100)


class StudentDetail(StudentProfileBase):
    model_config = ConfigDict(from_attributes=True)

    x_id: str
    total_xp: int
    level_number: int
    created_time: datetime
    # Flattened from the related User so the dashboard needs a single call.
    email: EmailStr | None = None
    firstname: str | None = None
    lastname: str | None = None
    pseudo: str | None = None
    phone: str | None = None
    member_type: str = 'student'
    reputation: int = 0
    avatar: AvatarDetail | None = None


class LevelDetail(SchemaBase):
    """Where the student stands on the XP ladder."""

    level_number: int
    total_xp: int
    xp_into_level: int
    xp_for_next_level: int
    progress_percent: int
    title: str


class LabProgressDetail(SchemaBase):
    lab_slug: str
    lab_name: str
    total_experiments: int
    completed_experiments: int
    progress_percent: int
    xp_earned: int


class ProgressDetail(SchemaBase):
    """Payload of ``GET /students/me/progress`` - the whole dashboard."""

    level: LevelDetail
    total_experiments: int
    completed_experiments: int
    in_progress_experiments: int
    average_score: int
    achievements_unlocked: int
    labs: list[LabProgressDetail]


class AchievementDetail(SchemaBase):
    model_config = ConfigDict(from_attributes=True)

    x_id: str
    name: str
    slug: str
    description: str | None = None
    icon: str
    xp_reward: int
    unlocked: bool = False
    unlocked_at: datetime | None = None
