"""Student profile, MyLab state and global progression."""
from __future__ import annotations

from typing import Sequence

from backend.app.client.schema.student import (
    AvatarTransformParam,
    UpdateStudentProfileParam,
    UpsertAvatarParam,
)
from backend.app.client.service.gamification import level_detail
from backend.common.enums import ExperimentStatusType
from backend.common.exception import errors
from backend.crud.crud_achievement import achievement_dao, student_achievement_dao
from backend.crud.crud_lab import lab_dao
from backend.crud.crud_student import avatar_dao, student_dao
from backend.crud.crud_student_experiment import student_experiment_dao
from backend.utils.timezone import timezone
from backend.crud.crud_user import user_dao
from backend.database.db_postgres import async_db_session
from backend.models import StudentProfile


class StudentService:
    """Everything hanging off ``/students/me``.

    The profile is created on demand rather than at registration: the auth core
    stays a generic user store, and SignalLab owns its own onboarding.
    """

    @staticmethod
    async def ensure_profile(db, user_id: int) -> StudentProfile:
        """Return the student's profile, creating it and its avatar if needed.

        The avatar is fetched through its own DAO rather than through
        ``profile.avatar``: re-selecting a row already in the identity map does
        not refresh its relationships, so a profile created moments earlier
        would still report no avatar.
        """
        profile = await student_dao.get_by_user_id(db, user_id)
        if profile is None:
            profile = await student_dao.create_for_user(db, user_id)

        avatar = await avatar_dao.get_by_student(db, profile.id)
        if avatar is None:
            avatar = await avatar_dao.create_default(db, profile.id)
        return profile

    @staticmethod
    async def _avatar_of(db, profile: StudentProfile):
        """Avatar row for a profile, without trusting the cached relationship."""
        return await avatar_dao.get_by_student(db, profile.id)

    async def get_profile(self, *, user_id: int) -> dict:
        async with async_db_session.begin() as db:
            profile = await self.ensure_profile(db, user_id)
            return self._serialize(profile, await self._avatar_of(db, profile))

    async def update_profile(self, *, user_id: int, obj: UpdateStudentProfileParam) -> dict:
        async with async_db_session.begin() as db:
            profile = await self.ensure_profile(db, user_id)
            data = obj.model_dump(exclude_unset=True)

            # Identity fields belong to the auth user, pedagogy to the profile.
            for field in ('firstname', 'lastname'):
                if field in data and data[field] is not None:
                    setattr(profile.user, field, data.pop(field))
                else:
                    data.pop(field, None)
            # Consent is timestamped: we must be able to say when it was given.
            opt_in = data.pop('whatsapp_opt_in', None)
            if opt_in is not None and opt_in != profile.whatsapp_opt_in:
                profile.whatsapp_opt_in = opt_in
                profile.whatsapp_opt_in_at = timezone.now() if opt_in else None
            for field, value in data.items():
                setattr(profile, field, value)

            db.add(profile)
            await db.flush()
            return self._serialize(profile, await self._avatar_of(db, profile))

    # -- Avatar -------------------------------------------------------------

    async def get_avatar(self, *, user_id: int) -> dict:
        async with async_db_session.begin() as db:
            profile = await self.ensure_profile(db, user_id)
            return self._serialize_avatar(await self._avatar_of(db, profile))

    async def upsert_avatar(self, *, user_id: int, obj: UpsertAvatarParam) -> dict:
        async with async_db_session.begin() as db:
            profile = await self.ensure_profile(db, user_id)
            avatar = await self._avatar_of(db, profile)
            for field, value in obj.model_dump(exclude_unset=True).items():
                if value is not None:
                    setattr(avatar, field, value)
            db.add(avatar)
            await db.flush()
            return self._serialize_avatar(avatar)

    async def save_transform(self, *, user_id: int, obj: AvatarTransformParam) -> dict:
        """Persist where the avatar stands so the world resumes in place."""
        async with async_db_session.begin() as db:
            profile = await self.ensure_profile(db, user_id)
            avatar = await self._avatar_of(db, profile)
            for field, value in obj.model_dump().items():
                setattr(avatar, field, value)
            db.add(avatar)
            await db.flush()
            return self._serialize_avatar(avatar)

    # -- Progression --------------------------------------------------------

    async def get_progress(self, *, user_id: int) -> dict:
        async with async_db_session.begin() as db:
            profile = await self.ensure_profile(db, user_id)
            labs = await lab_dao.get_all_active(db)
            counts = await lab_dao.count_experiments(db)
            states = await student_experiment_dao.get_all_for_student(db, profile.id)
            unlocked = await student_achievement_dao.unlocked_ids(db, profile.id)

            by_lab: dict[int, list] = {}
            for state in states:
                by_lab.setdefault(state.experiment.lab_id, []).append(state)

            lab_progress = []
            for lab in labs:
                total = counts.get(lab.id, 0)
                lab_states = by_lab.get(lab.id, [])
                completed = sum(
                    1 for s in lab_states if s.status == ExperimentStatusType.completed.value
                )
                lab_progress.append(
                    {
                        'lab_slug': lab.slug,
                        'lab_name': lab.name,
                        'total_experiments': total,
                        'completed_experiments': completed,
                        'progress_percent': int(round(100 * completed / total)) if total else 0,
                        'xp_earned': sum(s.xp_earned for s in lab_states),
                    }
                )

            completed_states = [
                s for s in states if s.status == ExperimentStatusType.completed.value
            ]
            scores = [s.best_score for s in completed_states]
            return {
                'level': level_detail(profile.total_xp),
                'total_experiments': sum(counts.values()),
                'completed_experiments': len(completed_states),
                'in_progress_experiments': sum(
                    1 for s in states if s.status == ExperimentStatusType.in_progress.value
                ),
                'average_score': int(round(sum(scores) / len(scores))) if scores else 0,
                'achievements_unlocked': len(unlocked),
                'labs': lab_progress,
            }

    async def get_achievements(self, *, user_id: int) -> list[dict]:
        """All badges, unlocked ones flagged - the trophy wall shows both."""
        async with async_db_session.begin() as db:
            profile = await self.ensure_profile(db, user_id)
            catalogue = await achievement_dao.get_all_active(db)
            unlocked_rows = await student_achievement_dao.get_all_for_student(db, profile.id)
            unlocked_at = {row.achievement_id: row.unlocked_at for row in unlocked_rows}

            return [
                {
                    'x_id': item.x_id,
                    'name': item.name,
                    'slug': item.slug,
                    'description': item.description,
                    'icon': item.icon,
                    'xp_reward': item.xp_reward,
                    'unlocked': item.id in unlocked_at,
                    'unlocked_at': unlocked_at.get(item.id),
                }
                for item in catalogue
            ]

    async def get_history(self, *, user_id: int, limit: int = 20) -> list[dict]:
        async with async_db_session.begin() as db:
            profile = await self.ensure_profile(db, user_id)
            rows = await student_experiment_dao.get_history(db, profile.id, limit=limit)
            return [
                {
                    'experiment_slug': row.experiment.slug,
                    'experiment_title': row.experiment.title,
                    'lab_slug': row.experiment.lab.slug,
                    'status': row.status,
                    'progress': row.progress,
                    'score': row.score,
                    'best_score': row.best_score,
                    'xp_earned': row.xp_earned,
                    'attempts': row.attempts,
                    'updated_time': row.updated_time,
                    'completed_at': row.completed_at,
                }
                for row in rows
            ]

    # -- Serialization ------------------------------------------------------

    @staticmethod
    def _serialize_avatar(avatar) -> dict:
        if avatar is None:
            return {}
        return {
            'x_id': avatar.x_id,
            'model': avatar.model,
            'skin': avatar.skin,
            'hair': avatar.hair,
            'outfit': avatar.outfit,
            'accessories': avatar.accessories or [],
            'position_x': avatar.position_x,
            'position_y': avatar.position_y,
            'position_z': avatar.position_z,
            'rotation': avatar.rotation,
        }

    def _serialize(self, profile: StudentProfile, avatar=None) -> dict:
        return {
            'x_id': profile.x_id,
            'bio': profile.bio,
            'institution': profile.institution,
            'level': profile.level,
            'filiere': profile.filiere,
            'member_type': profile.member_type,
            'reputation': profile.reputation,
            'whatsapp_opt_in': profile.whatsapp_opt_in,
            'total_xp': profile.total_xp,
            'level_number': profile.level_number,
            'created_time': profile.created_time,
            'email': profile.user.email if profile.user else None,
            'firstname': profile.user.firstname if profile.user else None,
            'lastname': profile.user.lastname if profile.user else None,
            'pseudo': profile.user.pseudo if profile.user else None,
            'phone': profile.user.phone if profile.user else None,
            'avatar': self._serialize_avatar(avatar) or None,
        }


student_service = StudentService()
