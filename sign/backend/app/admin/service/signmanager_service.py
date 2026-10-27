"""SignManager: platform-wide view of students and experiments.

This is the V0.3 "espace professeur" of the fiche technique, reduced to what an
administrator actually needs on day one: who is registered, how far they got,
and which TP is blocking a cohort.
"""
from __future__ import annotations

from typing import Sequence

from sqlalchemy import Integer, case, func, select
from sqlalchemy.orm import joinedload

from backend.app.admin.schema.signmanager import (
    UpdateStudentRolesParam,
    UpdateStudentStatusParam,
)
from backend.common.enums import ExperimentStatusType
from backend.common.exception import errors
from backend.crud.crud_role import role_dao
from backend.crud.crud_user import user_dao
from backend.core.conf import settings
from backend.database.db_postgres import async_db_session
from backend.database.db_redis import redis_client
from backend.models import (
    Achievement,
    Experiment,
    Lab,
    StudentAchievement,
    StudentExperiment,
    StudentProfile,
    User,
)


async def _forget_cached_user(user_x_id: str) -> None:
    """Drop the user snapshot the JWT middleware caches for a week.

    Without this a new role (e.g. 'teacher') or a deactivation would only take
    effect when that cache expired.
    """
    await redis_client.delete(f'{settings.JWT_USER_REDIS_PREFIX}:{user_x_id}')


class SignManagerService:
    # -- Overview -----------------------------------------------------------

    @staticmethod
    async def overview() -> dict:
        async with async_db_session() as db:
            total_students = (
                await db.execute(select(func.count()).select_from(StudentProfile))
            ).scalar_one()
            active_students = (
                await db.execute(
                    select(func.count())
                    .select_from(StudentProfile)
                    .join(User, User.id == StudentProfile.user_id)
                    .where(User.status.is_(True))
                )
            ).scalar_one()

            completed_filter = StudentExperiment.status == ExperimentStatusType.completed.value
            completed_total = (
                await db.execute(
                    select(func.count()).select_from(StudentExperiment).where(completed_filter)
                )
            ).scalar_one()
            engaged = (
                await db.execute(
                    select(func.count(func.distinct(StudentExperiment.student_id))).where(
                        completed_filter
                    )
                )
            ).scalar_one()
            total_xp = (
                await db.execute(select(func.coalesce(func.sum(StudentProfile.total_xp), 0)))
            ).scalar_one()
            average_score = (
                await db.execute(
                    select(func.coalesce(func.avg(StudentExperiment.best_score), 0)).where(
                        completed_filter
                    )
                )
            ).scalar_one()
            badges = (
                await db.execute(select(func.count()).select_from(StudentAchievement))
            ).scalar_one()

            # Per-experiment funnel: the number that tells a teacher which TP
            # a cohort is stuck on.
            rows = (
                await db.execute(
                    select(
                        Experiment.slug,
                        Experiment.title,
                        Lab.slug,
                        func.count(StudentExperiment.id),
                        func.coalesce(
                            func.sum(case((completed_filter, 1), else_=0).cast(Integer)), 0
                        ),
                        func.coalesce(func.avg(StudentExperiment.best_score), 0),
                        func.coalesce(func.avg(StudentExperiment.attempts), 0),
                    )
                    .select_from(Experiment)
                    .join(Lab, Lab.id == Experiment.lab_id)
                    .outerjoin(StudentExperiment, StudentExperiment.experiment_id == Experiment.id)
                    .group_by(Experiment.slug, Experiment.title, Lab.slug, Experiment.order)
                    .order_by(Experiment.order)
                )
            ).all()

            experiments = []
            for slug, title, lab_slug, started, completed, avg_score, avg_attempts in rows:
                started = int(started or 0)
                completed = int(completed or 0)
                experiments.append(
                    {
                        'slug': slug,
                        'title': title,
                        'lab_slug': lab_slug,
                        'started': started,
                        'completed': completed,
                        'completion_rate': int(round(100 * completed / started)) if started else 0,
                        'average_score': int(round(float(avg_score or 0))),
                        'average_attempts': round(float(avg_attempts or 0), 2),
                    }
                )

            return {
                'counters': {
                    'total_students': int(total_students),
                    'active_students': int(active_students),
                    'inactive_students': int(total_students) - int(active_students),
                    'engaged_students': int(engaged),
                    'total_experiments_completed': int(completed_total),
                    'total_xp_awarded': int(total_xp),
                    'average_score': int(round(float(average_score or 0))),
                    'badges_unlocked': int(badges),
                },
                'experiments': experiments,
            }

    # -- Students -----------------------------------------------------------

    @staticmethod
    def _serialize(profile: StudentProfile, completed: int, average: int, badges: int) -> dict:
        user = profile.user
        return {
            'x_id': profile.x_id,
            'user_x_id': user.x_id,
            'email': user.email,
            'phone': user.phone,
            'pseudo': user.pseudo,
            'filiere': profile.filiere,
            'member_type': profile.member_type,
            'reputation': profile.reputation,
            'whatsapp_opt_in': profile.whatsapp_opt_in,
            'firstname': user.firstname,
            'lastname': user.lastname,
            'institution': profile.institution,
            'level': profile.level,
            'status': bool(user.status),
            'roles': [role.name for role in (user.roles or [])],
            'total_xp': profile.total_xp,
            'level_number': profile.level_number,
            'completed_experiments': completed,
            'average_score': average,
            'badges': badges,
            'join_time': user.join_time,
            'last_login_time': user.last_login_time,
        }

    async def list_students(
        self,
        *,
        search: str | None = None,
        status: bool | None = None,
        page: int = 1,
        size: int = 20,
    ) -> dict:
        page = max(page, 1)
        size = min(max(size, 1), 100)

        async with async_db_session() as db:
            stmt = (
                select(StudentProfile)
                .join(User, User.id == StudentProfile.user_id)
                .options(joinedload(StudentProfile.user))
            )
            if search:
                pattern = f'%{search.lower()}%'
                stmt = stmt.where(
                    func.lower(func.coalesce(User.email, '')).like(pattern)
                    | func.lower(func.coalesce(User.pseudo, '')).like(pattern)
                    | func.coalesce(User.phone, '').like(pattern)
                    | func.lower(func.coalesce(User.firstname, '')).like(pattern)
                    | func.lower(func.coalesce(User.lastname, '')).like(pattern)
                )
            if status is not None:
                stmt = stmt.where(User.status.is_(status))

            total = (
                await db.execute(select(func.count()).select_from(stmt.subquery()))
            ).scalar_one()

            stmt = (
                stmt.order_by(StudentProfile.total_xp.desc(), StudentProfile.id.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
            profiles: Sequence[StudentProfile] = (
                (await db.execute(stmt)).unique().scalars().all()
            )

            ids = [profile.id for profile in profiles]
            stats = await self._stats_for(db, ids)

            return {
                'items': [
                    self._serialize(profile, *stats.get(profile.id, (0, 0, 0)))
                    for profile in profiles
                ],
                'total': int(total),
                'page': page,
                'size': size,
                'total_pages': (int(total) + size - 1) // size,
            }

    @staticmethod
    async def _stats_for(db, student_ids: list[int]) -> dict[int, tuple[int, int, int]]:
        """``{student_id: (completed, average best score, badges)}`` in two queries.

        Computed in bulk rather than per row: a 200-student listing must not be
        400 round trips.
        """
        if not student_ids:
            return {}

        completed_rows = (
            await db.execute(
                select(
                    StudentExperiment.student_id,
                    func.count(StudentExperiment.id),
                    func.coalesce(func.avg(StudentExperiment.best_score), 0),
                )
                .where(
                    StudentExperiment.student_id.in_(student_ids),
                    StudentExperiment.status == ExperimentStatusType.completed.value,
                )
                .group_by(StudentExperiment.student_id)
            )
        ).all()
        badge_rows = (
            await db.execute(
                select(StudentAchievement.student_id, func.count(StudentAchievement.id))
                .where(StudentAchievement.student_id.in_(student_ids))
                .group_by(StudentAchievement.student_id)
            )
        ).all()

        badges = {student_id: int(count) for student_id, count in badge_rows}
        stats: dict[int, tuple[int, int, int]] = {}
        for student_id, count, average in completed_rows:
            stats[student_id] = (int(count), int(round(float(average or 0))), badges.get(student_id, 0))
        for student_id, count in badges.items():
            stats.setdefault(student_id, (0, 0, count))
        return stats

    async def get_student(self, *, x_id: str) -> dict:
        async with async_db_session() as db:
            profile = (
                await db.execute(
                    select(StudentProfile)
                    .where(StudentProfile.x_id == x_id)
                    .options(joinedload(StudentProfile.user))
                )
            ).unique().scalars().first()
            if profile is None:
                raise errors.NotFoundError(msg='Student not found')

            stats = await self._stats_for(db, [profile.id])
            data = self._serialize(profile, *stats.get(profile.id, (0, 0, 0)))
            data['bio'] = profile.bio

            states = (
                await db.execute(
                    select(StudentExperiment)
                    .where(StudentExperiment.student_id == profile.id)
                    .options(
                        joinedload(StudentExperiment.experiment).joinedload(Experiment.lab)
                    )
                    .order_by(StudentExperiment.updated_time.desc().nullslast())
                )
            ).unique().scalars().all()

            data['experiments'] = [
                {
                    'experiment_slug': state.experiment.slug,
                    'experiment_title': state.experiment.title,
                    'lab_slug': state.experiment.lab.slug,
                    'status': state.status,
                    'progress': state.progress,
                    'score': state.score,
                    'best_score': state.best_score,
                    'xp_earned': state.xp_earned,
                    'attempts': state.attempts,
                    'started_at': state.started_at,
                    'completed_at': state.completed_at,
                }
                for state in states
            ]

            unlocked = (
                await db.execute(
                    select(Achievement.name)
                    .join(StudentAchievement, StudentAchievement.achievement_id == Achievement.id)
                    .where(StudentAchievement.student_id == profile.id)
                )
            ).scalars().all()
            data['achievements'] = list(unlocked)
            return data

    # -- Moderation ---------------------------------------------------------

    @staticmethod
    async def set_status(*, x_id: str, obj: UpdateStudentStatusParam, actor_id: int) -> None:
        """Enable or disable an account.

        Refusing to let an administrator lock themselves out is not paternalism
        here: it is the difference between a mistake and an unrecoverable one.
        """
        async with async_db_session.begin() as db:
            profile = (
                await db.execute(
                    select(StudentProfile)
                    .where(StudentProfile.x_id == x_id)
                    .options(joinedload(StudentProfile.user))
                )
            ).unique().scalars().first()
            if profile is None:
                raise errors.NotFoundError(msg='Student not found')
            if profile.user_id == actor_id and obj.status is False:
                raise errors.ForbiddenError(msg='You cannot deactivate your own account')
            profile.user.status = obj.status
            db.add(profile.user)
            user_x_id = profile.user.x_id
        await _forget_cached_user(user_x_id)

    @staticmethod
    async def set_roles(*, x_id: str, obj: UpdateStudentRolesParam, actor_id: int) -> None:
        async with async_db_session.begin() as db:
            profile = (
                await db.execute(
                    select(StudentProfile)
                    .where(StudentProfile.x_id == x_id)
                    .options(joinedload(StudentProfile.user))
                )
            ).unique().scalars().first()
            if profile is None:
                raise errors.NotFoundError(msg='Student not found')

            roles = []
            for name in obj.roles:
                role = await role_dao.get_by_name(db, name)
                if role is None:
                    raise errors.RequestError(msg=f'Unknown role: {name}')
                roles.append(role)

            if profile.user_id == actor_id and not any(role.name == 'admin' for role in roles):
                raise errors.ForbiddenError(msg='You cannot remove your own admin role')

            user = await user_dao.get_with_relation(db, id=profile.user_id)
            user.roles = roles
            db.add(user)
            user_x_id = user.x_id
        await _forget_cached_user(user_x_id)


signmanager_service = SignManagerService()
