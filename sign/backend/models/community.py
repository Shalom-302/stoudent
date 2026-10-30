"""STOUDENT community: questions, answers, votes, resources and reports.

Tags, filière and matière are plain strings rather than lookup tables: the MVP
needs to filter on them, not administer them, and a student typing a new
matière should not wait for an admin to create it.
"""
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.common.model import Base, get_id, id_key


class Question(Base):
    __tablename__ = 'question'
    __table_args__ = (
        sa.Index('ix_question_tags', 'tags', postgresql_using='gin'),
        # Full-text search over title + body, French stemming ("filtres" finds
        # "filtre"). The expression must match the one in crud_community.
        sa.Index(
            'ix_question_fts',
            sa.text("to_tsvector('french', coalesce(title, '') || ' ' || coalesce(body, ''))"),
            postgresql_using='gin',
        ),
    )

    id: Mapped[id_key] = mapped_column(init=False)
    x_id: Mapped[str] = mapped_column(sa.String(32), init=False, unique=True, default=get_id)
    author_id: Mapped[int] = mapped_column(sa.ForeignKey('user.id', ondelete='CASCADE'), index=True)
    title: Mapped[str] = mapped_column(sa.String(200))
    body: Mapped[str] = mapped_column(sa.Text)
    filiere: Mapped[str] = mapped_column(sa.String(100), index=True)
    subject: Mapped[str | None] = mapped_column(sa.String(100), index=True, default=None)
    tags: Mapped[list[str]] = mapped_column(ARRAY(sa.String(40)), default_factory=list, server_default='{}')
    # Optional picture of the exercise statement: a same-origin path served by
    # the API (/api/v1/community/uploads/<key>), never a third-party URL.
    image_url: Mapped[str | None] = mapped_column(sa.String(500), default=None)
    score: Mapped[int] = mapped_column(sa.Integer, init=False, default=0, server_default='0')
    answer_count: Mapped[int] = mapped_column(sa.Integer, init=False, default=0, server_default='0')
    view_count: Mapped[int] = mapped_column(sa.Integer, init=False, default=0, server_default='0')
    # Taps on "Partager sur WhatsApp": WhatsApp never says whether the message
    # was actually sent, so this counts the intent, once per member per hour.
    share_count: Mapped[int] = mapped_column(sa.Integer, init=False, default=0, server_default='0')
    comment_count: Mapped[int] = mapped_column(sa.Integer, init=False, default=0, server_default='0')
    accepted_answer_id: Mapped[int | None] = mapped_column(
        sa.ForeignKey('answer.id', ondelete='SET NULL', use_alter=True), init=False, default=None
    )
    is_hidden: Mapped[bool] = mapped_column(sa.Boolean, init=False, default=False, server_default='0', index=True)
    # Set when the asker got the one WhatsApp message about a first answer.
    answer_notified_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), init=False, default=None)
    # Set when the author edits; updated_time also moves on every vote.
    edited_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), init=False, default=None)

    author: Mapped['User'] = relationship(init=False, lazy='joined')


class Answer(Base):
    __tablename__ = 'answer'

    id: Mapped[id_key] = mapped_column(init=False)
    x_id: Mapped[str] = mapped_column(sa.String(32), init=False, unique=True, default=get_id)
    question_id: Mapped[int] = mapped_column(sa.ForeignKey('question.id', ondelete='CASCADE'), index=True)
    author_id: Mapped[int] = mapped_column(sa.ForeignKey('user.id', ondelete='CASCADE'), index=True)
    body: Mapped[str] = mapped_column(sa.Text)
    # Optional photo of a handwritten solution, same rules as the question's.
    image_url: Mapped[str | None] = mapped_column(sa.String(500), default=None)
    score: Mapped[int] = mapped_column(sa.Integer, init=False, default=0, server_default='0')
    is_accepted: Mapped[bool] = mapped_column(sa.Boolean, init=False, default=False, server_default='0')
    # A verified teacher vouched for this answer.
    teacher_endorsed: Mapped[bool] = mapped_column(sa.Boolean, init=False, default=False, server_default='0')
    # "🙏 Merci" from readers, separate from the score: thanking is not judging.
    thanks_count: Mapped[int] = mapped_column(sa.Integer, init=False, default=0, server_default='0')
    comment_count: Mapped[int] = mapped_column(sa.Integer, init=False, default=0, server_default='0')
    is_hidden: Mapped[bool] = mapped_column(sa.Boolean, init=False, default=False, server_default='0', index=True)
    edited_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True), init=False, default=None)

    author: Mapped['User'] = relationship(init=False, lazy='joined')


class Comment(Base):
    """A short remark under a question or an answer ("tu as oublié le facteur 2").

    Not an answer: no votes, no reputation. ``target_type`` is 'question' or
    'answer'; ``question_id`` is kept on both so a question's thread and its
    deletion need no join through answers.
    """

    __tablename__ = 'comment'
    __table_args__ = (sa.Index('ix_comment_target', 'target_type', 'target_id'),)

    id: Mapped[id_key] = mapped_column(init=False)
    x_id: Mapped[str] = mapped_column(sa.String(32), init=False, unique=True, default=get_id)
    question_id: Mapped[int] = mapped_column(sa.ForeignKey('question.id', ondelete='CASCADE'), index=True)
    target_type: Mapped[str] = mapped_column(sa.String(20))  # 'question' | 'answer'
    target_id: Mapped[int] = mapped_column(sa.Integer)
    author_id: Mapped[int] = mapped_column(sa.ForeignKey('user.id', ondelete='CASCADE'), index=True)
    body: Mapped[str] = mapped_column(sa.String(600))
    is_hidden: Mapped[bool] = mapped_column(sa.Boolean, init=False, default=False, server_default='0', index=True)

    author: Mapped['User'] = relationship(init=False, lazy='joined')


class Vote(Base):
    """One member, one vote per target. ``value`` is +1 or -1.

    target_type 'thanks' records a "Merci" on an answer (value always 1).
    """

    __tablename__ = 'vote'
    __table_args__ = (sa.UniqueConstraint('user_id', 'target_type', 'target_id', name='uq_vote_user_target'),)

    id: Mapped[id_key] = mapped_column(init=False)
    user_id: Mapped[int] = mapped_column(sa.ForeignKey('user.id', ondelete='CASCADE'), index=True)
    target_type: Mapped[str] = mapped_column(sa.String(20))  # 'question' | 'answer' | 'thanks'
    target_id: Mapped[int] = mapped_column(sa.Integer, index=True)
    value: Mapped[int] = mapped_column(sa.SmallInteger)


class Resource(Base):
    """A link to an external course, documentation or video.

    STOUDENT stores the link and its attribution, never a copy of the content.
    """

    __tablename__ = 'resource'

    id: Mapped[id_key] = mapped_column(init=False)
    x_id: Mapped[str] = mapped_column(sa.String(32), init=False, unique=True, default=get_id)
    author_id: Mapped[int] = mapped_column(sa.ForeignKey('user.id', ondelete='CASCADE'), index=True)
    title: Mapped[str] = mapped_column(sa.String(200))
    url: Mapped[str] = mapped_column(sa.String(1000))
    filiere: Mapped[str] = mapped_column(sa.String(100), index=True)
    subject: Mapped[str | None] = mapped_column(sa.String(100), index=True, default=None)
    # Organisation or author the resource comes from.
    source: Mapped[str | None] = mapped_column(sa.String(200), default=None)
    description: Mapped[str | None] = mapped_column(sa.Text, default=None)
    # 'sujet' (examen ou devoir), 'corrige', 'cours', 'td' (exercices), 'autre'.
    kind: Mapped[str] = mapped_column(sa.String(20), default='autre', server_default='autre', index=True)
    chapter: Mapped[str | None] = mapped_column(sa.String(150), default=None)
    session_year: Mapped[int | None] = mapped_column(sa.SmallInteger, default=None, index=True)
    # Who wrote the document, when known (the source being the site hosting it).
    original_author: Mapped[str | None] = mapped_column(sa.String(150), default=None)
    # Members' links wait for an admin; the imported catalogue is published.
    status: Mapped[str] = mapped_column(sa.String(20), default='published', server_default='published', index=True)
    open_count: Mapped[int] = mapped_column(sa.Integer, init=False, default=0, server_default='0')
    is_hidden: Mapped[bool] = mapped_column(sa.Boolean, init=False, default=False, server_default='0', index=True)

    author: Mapped['User'] = relationship(init=False, lazy='joined')


class Report(Base):
    """A member flagging a question, an answer or a resource."""

    __tablename__ = 'report'
    __table_args__ = (sa.UniqueConstraint('reporter_id', 'target_type', 'target_id', name='uq_report_reporter_target'),)

    id: Mapped[id_key] = mapped_column(init=False)
    x_id: Mapped[str] = mapped_column(sa.String(32), init=False, unique=True, default=get_id)
    reporter_id: Mapped[int] = mapped_column(sa.ForeignKey('user.id', ondelete='CASCADE'), index=True)
    target_type: Mapped[str] = mapped_column(sa.String(20))  # 'question' | 'answer' | 'resource'
    target_id: Mapped[int] = mapped_column(sa.Integer, index=True)
    reason: Mapped[str] = mapped_column(sa.String(40))
    details: Mapped[str | None] = mapped_column(sa.String(500), default=None)
    status: Mapped[str] = mapped_column(sa.String(20), init=False, default='open', server_default='open', index=True)


class Notification(Base):
    """Something happened to one of the member's posts.

    ``kind``: 'answer' (new answer to my question), 'accepted' (my answer was
    chosen), 'endorsed' (a teacher validated my answer), 'thanks', 'comment'
    (a comment on my question or answer).
    """

    __tablename__ = 'notification'
    __table_args__ = (sa.Index('ix_notification_user_unread', 'user_id', 'is_read'),)

    id: Mapped[id_key] = mapped_column(init=False)
    x_id: Mapped[str] = mapped_column(sa.String(32), init=False, unique=True, default=get_id)
    user_id: Mapped[int] = mapped_column(sa.ForeignKey('user.id', ondelete='CASCADE'), index=True)
    kind: Mapped[str] = mapped_column(sa.String(20))
    question_id: Mapped[int] = mapped_column(sa.ForeignKey('question.id', ondelete='CASCADE'))
    # Who triggered it, as shown (pseudo), so the list needs no join.
    actor: Mapped[str] = mapped_column(sa.String(60))
    is_read: Mapped[bool] = mapped_column(sa.Boolean, init=False, default=False, server_default='0')
