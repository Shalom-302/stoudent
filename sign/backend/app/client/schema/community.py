"""Schemas for the STOUDENT community (questions, answers, resources, reports)."""
from datetime import datetime
from typing import Literal

from pydantic import Field, HttpUrl, field_validator

from backend.common.schema import SchemaBase

MAX_TAGS = 5


def _clean_tags(tags: list[str]) -> list[str]:
    """Lowercase, dash-separated, deduplicated, order kept."""
    seen: list[str] = []
    for raw in tags:
        tag = '-'.join(raw.strip().lower().lstrip('#').split())
        if not tag:
            continue
        if len(tag) > 40 or not all(ch.isalnum() or ch in '-+.#_' for ch in tag):
            raise ValueError(f'Tag invalide : « {raw} ».')
        if tag not in seen:
            seen.append(tag)
    if len(seen) > MAX_TAGS:
        raise ValueError(f'{MAX_TAGS} tags maximum.')
    return seen


class CreateQuestionParam(SchemaBase):
    title: str = Field(min_length=10, max_length=200)
    body: str = Field(min_length=20, max_length=20_000)
    filiere: str = Field(min_length=2, max_length=100)
    subject: str | None = Field(default=None, max_length=100)
    tags: list[str] = Field(default_factory=list)
    image_url: HttpUrl | None = None

    _tags = field_validator('tags')(_clean_tags)

    @field_validator('title', 'body', 'filiere')
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @field_validator('subject')
    @classmethod
    def _strip_opt(cls, v: str | None) -> str | None:
        return (v.strip() or None) if v else None


class CreateAnswerParam(SchemaBase):
    body: str = Field(min_length=20, max_length=20_000)


class VoteParam(SchemaBase):
    target_type: Literal['question', 'answer']
    target_x_id: str = Field(min_length=8, max_length=32)
    # 0 withdraws the vote.
    value: Literal[-1, 0, 1]


class CreateResourceParam(SchemaBase):
    title: str = Field(min_length=5, max_length=200)
    url: HttpUrl
    filiere: str = Field(min_length=2, max_length=100)
    subject: str | None = Field(default=None, max_length=100)
    source: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=1000)

    @field_validator('url')
    @classmethod
    def _https_only(cls, v: HttpUrl) -> HttpUrl:
        if v.scheme not in ('http', 'https'):
            raise ValueError('Seuls les liens http(s) sont acceptés.')
        return v


ReportReason = Literal['spam', 'offensive', 'off_topic', 'plagiarism', 'broken_link', 'other']


class CreateReportParam(SchemaBase):
    target_type: Literal['question', 'answer', 'resource']
    target_x_id: str = Field(min_length=8, max_length=32)
    reason: ReportReason
    details: str | None = Field(default=None, max_length=500)


class AuthorDetail(SchemaBase):
    pseudo: str
    filiere: str | None = None
    level: str | None = None
    reputation: int = 0
    is_teacher: bool = False


class AnswerDetail(SchemaBase):
    x_id: str
    body: str
    score: int
    is_accepted: bool
    teacher_endorsed: bool
    created_time: datetime
    author: AuthorDetail
    my_vote: int = 0
    is_mine: bool = False


class QuestionSummary(SchemaBase):
    x_id: str
    title: str
    excerpt: str
    filiere: str
    subject: str | None = None
    tags: list[str] = []
    score: int
    answer_count: int
    view_count: int
    has_accepted: bool
    created_time: datetime
    author: AuthorDetail


class QuestionDetail(QuestionSummary):
    body: str
    image_url: str | None = None
    my_vote: int = 0
    is_mine: bool = False
    answers: list[AnswerDetail] = []


class ResourceDetail(SchemaBase):
    x_id: str
    title: str
    url: str
    domain: str
    filiere: str
    subject: str | None = None
    source: str | None = None
    description: str | None = None
    created_time: datetime
    author: AuthorDetail
