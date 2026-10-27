"""STOUDENT community: the question feed, answers, votes, resources, reports.

Counters (score, answer_count) are denormalised on the rows and kept in step
here, so the feed is one indexed query rather than a GROUP BY over votes.
Reputation follows the Stack Overflow intuition, scaled down: a useful answer
is worth more than a useful question, and an accepted answer most of all.
"""
from urllib.parse import urlparse

from fastapi import BackgroundTasks
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.exc import IntegrityError

from backend.app.client.service.notify_service import add_notification, notify_first_answer
from backend.app.client.schema.community import (
    CreateAnswerParam,
    CreateQuestionParam,
    CreateReportParam,
    CreateResourceParam,
    VoteParam,
)
from backend.common.enums import Role as RoleEnum
from backend.common.exception import errors
from backend.crud.crud_student import student_dao
from backend.database.db_postgres import async_db_session
from backend.database.db_redis import redis_client
from backend.models import StudentProfile, User
from backend.models.community import Answer, Notification, Question, Report, Resource, Vote
from backend.utils.timezone import timezone

REP_QUESTION_VOTE = 5
REP_ANSWER_VOTE = 10
REP_ACCEPTED = 15
REP_THANKS = 2
# Distinct reports after which a content is hidden pending moderation.
AUTO_HIDE_REPORTS = 3
EXCERPT_LENGTH = 220
# A reader counts as one view per question per hour, however often the page refetches.
VIEW_WINDOW_SECONDS = 3600

# Shown in the filters before the community has created its own.
# The BTS filières STOUDENT opens with (codes; names live in client/lib/community.ts).
DEFAULT_FILIERES = ['RIT', 'IDA', 'ELT', 'SEI', 'MSP', 'FC', 'GC', 'RHC', 'LOG', 'AD']

def _excerpt(text: str) -> str:
    flat = ' '.join(text.split())
    return flat if len(flat) <= EXCERPT_LENGTH else flat[:EXCERPT_LENGTH].rsplit(' ', 1)[0] + '…'


def _vote_reputation(value: int, weight: int) -> int:
    """Reputation a single vote is worth to the author.

    Downvotes cost a fifth of what upvotes earn, like on Stack Overflow.
    """
    if value > 0:
        return weight
    if value < 0:
        return -max(weight // 5, 1)
    return 0


def _is_teacher(user: User) -> bool:
    return any(role.name == RoleEnum.TEACHER.value for role in (user.roles or []))


async def _profiles_by_user(db, user_ids: set[int]) -> dict[int, StudentProfile]:
    if not user_ids:
        return {}
    rows = await db.execute(select(StudentProfile).where(StudentProfile.user_id.in_(user_ids)))
    return {p.user_id: p for p in rows.unique().scalars().all()}


def _author(user: User, profile: StudentProfile | None) -> dict:
    return {
        # No pseudo: a deleted account, or one created before STOUDENT. Never
        # fall back to the email or number.
        'pseudo': user.pseudo or ('Membre supprimé' if not user.status else f'membre-{user.x_id[-6:]}'),
        'filiere': profile.filiere if profile else None,
        'level': profile.level if profile else None,
        'reputation': profile.reputation if profile else 0,
        'is_teacher': _is_teacher(user),
    }


async def _is_new_view(question_id: int, viewer_key: str) -> bool:
    try:
        return bool(
            await redis_client.set(f'stoudent:view:{question_id}:{viewer_key}', '1', ex=VIEW_WINDOW_SECONDS, nx=True)
        )
    except Exception:  # noqa: BLE001 - a Redis hiccup must not break reading
        return False


async def _add_reputation(db, user_id: int, delta: int) -> None:
    if not delta:
        return
    profile = await student_dao.get_by_user_id(db, user_id)
    if profile is None:
        profile = await student_dao.create_for_user(db, user_id)
    # No floor at 0: every delta must be undoable (a withdrawn downvote gives
    # back exactly what it took), which a clamp would break.
    profile.reputation += delta


class CommunityService:
    # -- Feed ---------------------------------------------------------------

    @staticmethod
    async def list_questions(
        *,
        filiere: str | None,
        subject: str | None,
        tag: str | None,
        q: str | None,
        sort: str,
        page: int,
        size: int,
    ) -> dict:
        async with async_db_session() as db:
            stmt = select(Question).where(Question.is_hidden.is_(False))
            if filiere:
                stmt = stmt.where(func.lower(Question.filiere) == filiere.lower())
            if subject:
                stmt = stmt.where(func.lower(Question.subject) == subject.lower())
            if tag:
                stmt = stmt.where(Question.tags.any(tag.lower()))
            if q:
                # French full-text first; ILIKE on the title catches what the
                # stemmer cannot (acronyms, formulas, partial words).
                stmt = stmt.where(
                    or_(
                        func.to_tsvector('french', func.coalesce(Question.title, '') + ' ' + func.coalesce(Question.body, ''))
                        .op('@@')(func.plainto_tsquery('french', q)),
                        Question.title.ilike(f'%{q}%'),
                    )
                )
            if sort == 'unanswered':
                stmt = stmt.where(Question.answer_count == 0)

            total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()

            order = {
                'votes': (Question.score.desc(), Question.id.desc()),
                'active': (Question.answer_count.desc(), Question.id.desc()),
            }.get(sort, (Question.id.desc(),))
            rows = (
                await db.execute(stmt.order_by(*order).offset((page - 1) * size).limit(size))
            ).unique().scalars().all()

            profiles = await _profiles_by_user(db, {r.author_id for r in rows})
            return {
                'items': [CommunityService._summary(r, profiles.get(r.author_id)) for r in rows],
                'total': int(total),
                'page': page,
                'size': size,
                'total_pages': (int(total) + size - 1) // size,
            }

    @staticmethod
    def _summary(question: Question, profile: StudentProfile | None) -> dict:
        return {
            'x_id': question.x_id,
            'title': question.title,
            'excerpt': _excerpt(question.body),
            'filiere': question.filiere,
            'subject': question.subject,
            'tags': list(question.tags or []),
            'score': question.score,
            'answer_count': question.answer_count,
            'view_count': question.view_count,
            'has_accepted': question.accepted_answer_id is not None,
            'created_time': question.created_time,
            'author': _author(question.author, profile),
        }

    @staticmethod
    async def meta() -> dict:
        """Filters for the feed: known filières, matières and popular tags."""
        async with async_db_session() as db:
            filieres = (
                await db.execute(
                    select(StudentProfile.filiere).where(StudentProfile.filiere.is_not(None)).distinct()
                )
            ).scalars().all()
            subjects = (
                await db.execute(
                    select(Question.subject, func.count())
                    .where(Question.subject.is_not(None), Question.is_hidden.is_(False))
                    .group_by(Question.subject)
                    .order_by(func.count().desc())
                    .limit(30)
                )
            ).all()
            tag_col = func.unnest(Question.tags).label('tag')
            tags_sub = select(tag_col).where(Question.is_hidden.is_(False)).subquery()
            tags = (
                await db.execute(
                    select(tags_sub.c.tag, func.count())
                    .group_by(tags_sub.c.tag)
                    .order_by(func.count().desc())
                    .limit(20)
                )
            ).all()
            counts = (
                await db.execute(
                    select(
                        select(func.count(Question.id)).where(Question.is_hidden.is_(False)).scalar_subquery(),
                        select(func.count(Answer.id)).where(Answer.is_hidden.is_(False)).scalar_subquery(),
                        select(func.count(User.id)).scalar_subquery(),
                    )
                )
            ).one()
        known = {f.lower() for f in filieres}
        return {
            'filieres': sorted(set(filieres)) + [f for f in DEFAULT_FILIERES if f.lower() not in known],
            'subjects': [s for s, _ in subjects],
            'tags': [{'name': t, 'count': c} for t, c in tags],
            'stats': {'questions': counts[0], 'answers': counts[1], 'members': counts[2]},
        }

    # -- Questions ----------------------------------------------------------

    @staticmethod
    async def create_question(*, user_id: int, obj: CreateQuestionParam) -> dict:
        async with async_db_session.begin() as db:
            question = Question(
                author_id=user_id,
                title=obj.title,
                body=obj.body,
                filiere=obj.filiere,
                subject=obj.subject,
                tags=obj.tags,
                image_url=obj.image_url,
            )
            db.add(question)
            await db.flush()
            return {'x_id': question.x_id}

    @staticmethod
    async def _get_question(db, x_id: str, *, for_update: bool = False) -> Question:
        stmt = select(Question).where(Question.x_id == x_id, Question.is_hidden.is_(False))
        if for_update:
            stmt = stmt.with_for_update(of=Question)
        question = (await db.execute(stmt)).unique().scalars().first()
        if question is None:
            raise errors.NotFoundError(msg='Question introuvable.')
        return question

    async def get_question(self, *, x_id: str, viewer_id: int | None, viewer_ip: str) -> dict:
        async with async_db_session.begin() as db:
            question = await self._get_question(db, x_id)
            view_count = question.view_count
            if await _is_new_view(question.id, f'u{viewer_id}' if viewer_id else f'ip{viewer_ip}'):
                view_count = (
                    await db.execute(
                        update(Question)
                        .where(Question.id == question.id)
                        .values(view_count=Question.view_count + 1)
                        .returning(Question.view_count)
                    )
                ).scalar_one()
            answers = (
                await db.execute(
                    select(Answer)
                    .where(Answer.question_id == question.id, Answer.is_hidden.is_(False))
                    # Accepted first, then teacher-endorsed, then by votes.
                    .order_by(Answer.is_accepted.desc(), Answer.teacher_endorsed.desc(), Answer.score.desc(), Answer.id)
                )
            ).unique().scalars().all()

            profiles = await _profiles_by_user(db, {question.author_id, *(a.author_id for a in answers)})
            my_votes: dict[tuple[str, int], int] = {}
            if viewer_id:
                rows = await db.execute(
                    select(Vote.target_type, Vote.target_id, Vote.value).where(
                        Vote.user_id == viewer_id,
                        or_(
                            (Vote.target_type == 'question') & (Vote.target_id == question.id),
                            Vote.target_type.in_(('answer', 'thanks')) & Vote.target_id.in_([a.id for a in answers] or [0]),
                        ),
                    )
                )
                my_votes = {(t, i): v for t, i, v in rows.all()}

            data = self._summary(question, profiles.get(question.author_id))
            data['view_count'] = view_count
            data.update(
                body=question.body,
                image_url=question.image_url,
                edited=question.edited_at is not None,
                my_vote=my_votes.get(('question', question.id), 0),
                is_mine=viewer_id == question.author_id,
                answers=[
                    {
                        'x_id': a.x_id,
                        'body': a.body,
                        'score': a.score,
                        'is_accepted': a.is_accepted,
                        'teacher_endorsed': a.teacher_endorsed,
                        'thanks_count': a.thanks_count,
                        'created_time': a.created_time,
                        'edited': a.edited_at is not None,
                        'author': _author(a.author, profiles.get(a.author_id)),
                        'my_vote': my_votes.get(('answer', a.id), 0),
                        'my_thanks': ('thanks', a.id) in my_votes,
                        'is_mine': viewer_id == a.author_id,
                    }
                    for a in answers
                ],
            )
            return data

    async def delete_question(self, *, x_id: str, user_id: int) -> None:
        async with async_db_session.begin() as db:
            question = await self._get_question(db, x_id)
            if question.author_id != user_id:
                raise errors.ForbiddenError(msg='Seul l’auteur peut supprimer sa question.')
            if question.answer_count:
                # Answers are someone else's work: once answered, the question stays.
                raise errors.ForbiddenError(msg='Une question qui a reçu des réponses ne peut plus être supprimée.')
            await db.delete(question)

    # -- Answers ------------------------------------------------------------

    async def create_answer(
        self, *, question_x_id: str, user_id: int, obj: CreateAnswerParam, background: BackgroundTasks
    ) -> dict:
        async with async_db_session.begin() as db:
            question = await self._get_question(db, question_x_id, for_update=True)
            answer = Answer(question_id=question.id, author_id=user_id, body=obj.body.strip())
            db.add(answer)
            question.answer_count += 1
            actor = await db.get(User, user_id)
            notify = add_notification(db, user_id=question.author_id, kind='answer', question=question, actor=actor)
            await db.flush()
            result = {'x_id': answer.x_id}
        # After the commit: the asker is told only about an answer that exists.
        if notify:
            # WhatsApp only for the first answer (the task checks and marks it).
            background.add_task(
                notify_first_answer, user_id=question.author_id, question_x_id=question.x_id, title=question.title
            )
        return result

    async def accept_answer(self, *, question_x_id: str, answer_x_id: str, user_id: int) -> None:
        """Mark (or unmark, if already accepted) the solution the author kept."""
        async with async_db_session.begin() as db:
            question = await self._get_question(db, question_x_id, for_update=True)
            if question.author_id != user_id:
                raise errors.ForbiddenError(msg='Seul l’auteur de la question choisit la meilleure réponse.')
            answer = (
                await db.execute(
                    select(Answer).where(Answer.x_id == answer_x_id, Answer.question_id == question.id)
                )
            ).unique().scalars().first()
            if answer is None:
                raise errors.NotFoundError(msg='Réponse introuvable.')

            previous = None
            if question.accepted_answer_id:
                previous = await db.get(Answer, question.accepted_answer_id)
            if previous is not None:
                previous.is_accepted = False
                if previous.author_id != user_id:
                    await _add_reputation(db, previous.author_id, -REP_ACCEPTED)

            if previous is not None and previous.id == answer.id:
                question.accepted_answer_id = None
                return
            answer.is_accepted = True
            question.accepted_answer_id = answer.id
            # Accepting your own answer is allowed, rewarding it is not.
            if answer.author_id != user_id:
                await _add_reputation(db, answer.author_id, REP_ACCEPTED)
                actor = await db.get(User, user_id)
                add_notification(db, user_id=answer.author_id, kind='accepted', question=question, actor=actor)

    @staticmethod
    async def endorse_answer(*, answer_x_id: str, user_id: int) -> dict:
        """Teacher toggle: 'validée par un professeur'. The role check is in the route."""
        async with async_db_session.begin() as db:
            answer = (
                await db.execute(select(Answer).where(Answer.x_id == answer_x_id, Answer.is_hidden.is_(False)))
            ).unique().scalars().first()
            if answer is None:
                raise errors.NotFoundError(msg='Réponse introuvable.')
            answer.teacher_endorsed = not answer.teacher_endorsed
            if answer.teacher_endorsed and answer.author_id != user_id:
                question = await db.get(Question, answer.question_id)
                actor = await db.get(User, user_id)
                add_notification(db, user_id=answer.author_id, kind='endorsed', question=question, actor=actor)
            return {'teacher_endorsed': answer.teacher_endorsed}

    @staticmethod
    async def _own_answer(db, answer_x_id: str, user_id: int) -> Answer:
        answer = (
            await db.execute(
                select(Answer).where(Answer.x_id == answer_x_id, Answer.is_hidden.is_(False)).with_for_update(of=Answer)
            )
        ).unique().scalars().first()
        if answer is None:
            raise errors.NotFoundError(msg='Réponse introuvable.')
        if answer.author_id != user_id:
            raise errors.ForbiddenError(msg='Seul l’auteur peut modifier sa réponse.')
        return answer

    async def edit_question(self, *, x_id: str, user_id: int, obj: CreateQuestionParam) -> None:
        async with async_db_session.begin() as db:
            question = await self._get_question(db, x_id, for_update=True)
            if question.author_id != user_id:
                raise errors.ForbiddenError(msg='Seul l’auteur peut modifier sa question.')
            question.title = obj.title
            question.body = obj.body
            question.filiere = obj.filiere
            question.subject = obj.subject
            question.tags = obj.tags
            question.image_url = obj.image_url
            question.edited_at = timezone.now()

    async def edit_answer(self, *, answer_x_id: str, user_id: int, obj: CreateAnswerParam) -> None:
        async with async_db_session.begin() as db:
            answer = await self._own_answer(db, answer_x_id, user_id)
            answer.body = obj.body.strip()
            answer.edited_at = timezone.now()

    async def delete_answer(self, *, answer_x_id: str, user_id: int) -> None:
        """Delete my answer, taking back the reputation it earned."""
        async with async_db_session.begin() as db:
            answer = await self._own_answer(db, answer_x_id, user_id)
            # Lock the question row only: its eager author join cannot be locked.
            question = (
                await db.execute(select(Question).where(Question.id == answer.question_id).with_for_update(of=Question))
            ).unique().scalars().one()

            votes = (
                await db.execute(
                    select(Vote.target_type, Vote.value).where(
                        Vote.target_type.in_(('answer', 'thanks')), Vote.target_id == answer.id
                    )
                )
            ).all()
            earned = sum(
                _vote_reputation(v, REP_ANSWER_VOTE) if t == 'answer' else REP_THANKS for t, v in votes
            )
            if answer.is_accepted:
                question.accepted_answer_id = None
                if question.author_id != user_id:
                    earned += REP_ACCEPTED
            await _add_reputation(db, user_id, -earned)
            await db.execute(
                delete(Vote).where(Vote.target_type.in_(('answer', 'thanks')), Vote.target_id == answer.id)
            )
            question.answer_count = max(question.answer_count - 1, 0)
            await db.delete(answer)

    @staticmethod
    async def thank_answer(*, answer_x_id: str, user_id: int) -> dict:
        """Toggle "🙏 Merci" on an answer."""
        async with async_db_session.begin() as db:
            answer = (
                await db.execute(
                    select(Answer).where(Answer.x_id == answer_x_id, Answer.is_hidden.is_(False)).with_for_update(of=Answer)
                )
            ).unique().scalars().first()
            if answer is None:
                raise errors.NotFoundError(msg='Réponse introuvable.')
            if answer.author_id == user_id:
                raise errors.ForbiddenError(msg='Vous ne pouvez pas vous remercier vous-même.')
            existing = (
                await db.execute(
                    select(Vote).where(Vote.user_id == user_id, Vote.target_type == 'thanks', Vote.target_id == answer.id)
                )
            ).scalars().first()
            if existing:
                await db.delete(existing)
                answer.thanks_count = max(answer.thanks_count - 1, 0)
                await _add_reputation(db, answer.author_id, -REP_THANKS)
                return {'thanks_count': answer.thanks_count, 'thanked': False}
            db.add(Vote(user_id=user_id, target_type='thanks', target_id=answer.id, value=1))
            answer.thanks_count += 1
            await _add_reputation(db, answer.author_id, REP_THANKS)
            question = await db.get(Question, answer.question_id)
            actor = await db.get(User, user_id)
            add_notification(db, user_id=answer.author_id, kind='thanks', question=question, actor=actor)
            return {'thanks_count': answer.thanks_count, 'thanked': True}

    # -- Notifications ------------------------------------------------------

    @staticmethod
    async def list_notifications(*, user_id: int, limit: int) -> dict:
        async with async_db_session() as db:
            rows = (
                await db.execute(
                    select(Notification, Question.x_id, Question.title)
                    .join(Question, Question.id == Notification.question_id)
                    .where(Notification.user_id == user_id)
                    .order_by(Notification.id.desc())
                    .limit(limit)
                )
            ).all()
            unread = (
                await db.execute(
                    select(func.count(Notification.id)).where(
                        Notification.user_id == user_id, Notification.is_read.is_(False)
                    )
                )
            ).scalar_one()
        return {
            'unread': int(unread),
            'items': [
                {
                    'x_id': n.x_id,
                    'kind': n.kind,
                    'actor': n.actor,
                    'question_x_id': qx,
                    'question_title': title,
                    'is_read': n.is_read,
                    'created_time': n.created_time,
                }
                for n, qx, title in rows
            ],
        }

    @staticmethod
    async def mark_read(*, user_id: int, x_ids: list[str]) -> None:
        async with async_db_session.begin() as db:
            stmt = update(Notification).where(Notification.user_id == user_id, Notification.is_read.is_(False))
            if x_ids:
                stmt = stmt.where(Notification.x_id.in_(x_ids))
            await db.execute(stmt.values(is_read=True))

    # -- Votes --------------------------------------------------------------

    @staticmethod
    async def vote(*, user_id: int, obj: VoteParam) -> dict:
        model = Question if obj.target_type == 'question' else Answer
        weight = REP_QUESTION_VOTE if obj.target_type == 'question' else REP_ANSWER_VOTE
        async with async_db_session.begin() as db:
            target = (
                await db.execute(
                    select(model).where(model.x_id == obj.target_x_id, model.is_hidden.is_(False)).with_for_update(of=model)
                )
            ).unique().scalars().first()
            if target is None:
                raise errors.NotFoundError(msg='Contenu introuvable.')
            if target.author_id == user_id:
                raise errors.ForbiddenError(msg='Vous ne pouvez pas voter pour votre propre contenu.')

            existing = (
                await db.execute(
                    select(Vote).where(
                        Vote.user_id == user_id, Vote.target_type == obj.target_type, Vote.target_id == target.id
                    )
                )
            ).scalars().first()
            old = existing.value if existing else 0
            if old == obj.value:
                return {'score': target.score, 'my_vote': old}

            if existing and obj.value == 0:
                await db.delete(existing)
            elif existing:
                existing.value = obj.value
            else:
                db.add(Vote(user_id=user_id, target_type=obj.target_type, target_id=target.id, value=obj.value))

            delta = obj.value - old
            target.score += delta
            rep = _vote_reputation(obj.value, weight) - _vote_reputation(old, weight)
            await _add_reputation(db, target.author_id, rep)
            return {'score': target.score, 'my_vote': obj.value}

    # -- Resources ----------------------------------------------------------

    @staticmethod
    async def list_resources(*, filiere: str | None, subject: str | None, q: str | None, page: int, size: int) -> dict:
        async with async_db_session() as db:
            stmt = select(Resource).where(Resource.is_hidden.is_(False))
            if filiere:
                stmt = stmt.where(func.lower(Resource.filiere) == filiere.lower())
            if subject:
                stmt = stmt.where(func.lower(Resource.subject) == subject.lower())
            if q:
                pattern = f'%{q}%'
                stmt = stmt.where(
                    or_(Resource.title.ilike(pattern), Resource.description.ilike(pattern), Resource.source.ilike(pattern))
                )
            total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
            rows = (
                await db.execute(stmt.order_by(Resource.id.desc()).offset((page - 1) * size).limit(size))
            ).unique().scalars().all()
            profiles = await _profiles_by_user(db, {r.author_id for r in rows})
            return {
                'items': [
                    {
                        'x_id': r.x_id,
                        'title': r.title,
                        'url': r.url,
                        'domain': urlparse(r.url).hostname or '',
                        'filiere': r.filiere,
                        'subject': r.subject,
                        'source': r.source,
                        'description': r.description,
                        'created_time': r.created_time,
                        'author': _author(r.author, profiles.get(r.author_id)),
                    }
                    for r in rows
                ],
                'total': int(total),
                'page': page,
                'size': size,
                'total_pages': (int(total) + size - 1) // size,
            }

    @staticmethod
    async def create_resource(*, user_id: int, obj: CreateResourceParam) -> dict:
        async with async_db_session.begin() as db:
            url = str(obj.url)
            duplicate = (
                await db.execute(select(Resource.id).where(Resource.url == url, Resource.is_hidden.is_(False)))
            ).first()
            if duplicate:
                raise errors.ForbiddenError(msg='Ce lien a déjà été partagé.')
            resource = Resource(
                author_id=user_id,
                title=obj.title.strip(),
                url=url,
                filiere=obj.filiere.strip(),
                subject=obj.subject.strip() if obj.subject else None,
                source=obj.source.strip() if obj.source else None,
                description=obj.description.strip() if obj.description else None,
            )
            db.add(resource)
            await db.flush()
            return {'x_id': resource.x_id}

    # -- Reports ------------------------------------------------------------

    @staticmethod
    async def report(*, user_id: int, obj: CreateReportParam) -> dict:
        model = {'question': Question, 'answer': Answer, 'resource': Resource}[obj.target_type]
        async with async_db_session.begin() as db:
            target = (await db.execute(select(model).where(model.x_id == obj.target_x_id))).unique().scalars().first()
            if target is None:
                raise errors.NotFoundError(msg='Contenu introuvable.')
            try:
                async with db.begin_nested():
                    db.add(
                        Report(
                            reporter_id=user_id,
                            target_type=obj.target_type,
                            target_id=target.id,
                            reason=obj.reason,
                            details=obj.details,
                        )
                    )
            except IntegrityError:
                raise errors.ForbiddenError(msg='Vous avez déjà signalé ce contenu.')

            open_reports = (
                await db.execute(
                    select(func.count(Report.id)).where(
                        Report.target_type == obj.target_type, Report.target_id == target.id, Report.status == 'open'
                    )
                )
            ).scalar_one()
            if open_reports >= AUTO_HIDE_REPORTS:
                target.is_hidden = True
            return {'hidden': target.is_hidden}


community_service = CommunityService()
