"""Schemas for the STOUDENT community (questions, answers, resources, reports)."""
from datetime import datetime
from typing import Literal

from pydantic import Field, HttpUrl, field_validator

from backend.app.client.service.upload_service import URL_RE

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
    # Only a photo uploaded through /community/uploads: no third-party URL
    # (tracking pixels, hotlinked content) ever reaches the page.
    image_url: str | None = None

    _tags = field_validator('tags')(_clean_tags)

    @field_validator('image_url')
    @classmethod
    def _own_upload(cls, v: str | None) -> str | None:
        if v and not URL_RE.match(v):
            raise ValueError('Photo invalide : envoyez-la depuis le formulaire.')
        return v or None

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


class CreateCommentParam(SchemaBase):
    target_type: Literal['question', 'answer']
    target_x_id: str = Field(min_length=8, max_length=32)
    body: str = Field(min_length=2, max_length=600)

    @field_validator('body')
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError('Commentaire trop court.')
        return v


class VoteParam(SchemaBase):
    target_type: Literal['question', 'answer']
    target_x_id: str = Field(min_length=8, max_length=32)
    # 0 withdraws the vote.
    value: Literal[-1, 0, 1]


ResourceKind = Literal['sujet', 'corrige', 'cours', 'td', 'autre']


class CreateResourceParam(SchemaBase):
    title: str = Field(min_length=5, max_length=200)
    url: HttpUrl
    filiere: str = Field(min_length=2, max_length=100)
    subject: str | None = Field(default=None, max_length=100)
    source: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    kind: ResourceKind = 'autre'
    chapter: str | None = Field(default=None, max_length=150)
    session_year: int | None = Field(default=None, ge=1990, le=2100)
    original_author: str | None = Field(default=None, max_length=150)

    @field_validator('url')
    @classmethod
    def _https_only(cls, v: HttpUrl) -> HttpUrl:
        if v.scheme not in ('http', 'https'):
            raise ValueError('Seuls les liens http(s) sont acceptés.')
        return v


ReportReason = Literal['spam', 'offensive', 'off_topic', 'plagiarism', 'copyright', 'broken_link', 'other']


class CreateReportParam(SchemaBase):
    target_type: Literal['question', 'answer', 'resource', 'comment']
    target_x_id: str = Field(min_length=8, max_length=32)
    reason: ReportReason
    details: str | None = Field(default=None, max_length=500)


class AuthorDetail(SchemaBase):
    pseudo: str
    filiere: str | None = None
    level: str | None = None
    reputation: int = 0
    is_teacher: bool = False


class AnswerPreview(SchemaBase):
    """An answer as the feed shows it under its question: an extract."""

    x_id: str
    excerpt: str
    score: int
    is_accepted: bool
    teacher_endorsed: bool
    thanks_count: int = 0
    comment_count: int = 0
    created_time: datetime
    author: AuthorDetail
    # Up to three pseudos of members who found it useful, latest first, and
    # how many did (the score is net of downvotes).
    likers: list[str] = []
    like_count: int = 0
    my_vote: int = 0
    my_thanks: bool = False
    is_mine: bool = False


class AnswerDetail(AnswerPreview):
    body: str
    edited: bool = False


class QuestionSummary(SchemaBase):
    x_id: str
    title: str
    excerpt: str
    filiere: str
    subject: str | None = None
    tags: list[str] = []
    image_url: str | None = None
    score: int
    answer_count: int
    view_count: int
    share_count: int = 0
    comment_count: int = 0
    has_accepted: bool
    created_time: datetime
    author: AuthorDetail
    likers: list[str] = []
    like_count: int = 0
    my_vote: int = 0
    is_mine: bool = False
    # The accepted answer, else the best rated: read without opening the page.
    top_answer: AnswerPreview | None = None


class QuestionDetail(QuestionSummary):
    body: str
    edited: bool = False
    answers: list[AnswerDetail] = []


class CommentDetail(SchemaBase):
    x_id: str
    body: str
    created_time: datetime
    author: AuthorDetail
    is_mine: bool = False


class ResourceDetail(SchemaBase):
    x_id: str
    title: str
    url: str
    domain: str
    filiere: str
    subject: str | None = None
    source: str | None = None
    description: str | None = None
    kind: str = 'autre'
    chapter: str | None = None
    session_year: int | None = None
    original_author: str | None = None
    open_count: int = 0
    created_time: datetime
    author: AuthorDetail


class NotificationDetail(SchemaBase):
    x_id: str
    kind: str
    actor: str
    question_x_id: str
    question_title: str
    is_read: bool
    created_time: datetime


class MarkReadParam(SchemaBase):
    # Empty: mark everything read.
    x_ids: list[str] = Field(default_factory=list, max_length=100)
