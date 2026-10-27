"""Badge evaluation.

Criteria are data, not code: a new badge is a row, not a deploy. Each criterion
is a small pure predicate over the student's current state.
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from backend.common.enums import AchievementCriteriaType, ExperimentStatusType
from backend.crud.crud_achievement import achievement_dao, student_achievement_dao
from backend.crud.crud_lab import experiment_dao, lab_dao
from backend.crud.crud_student_experiment import student_experiment_dao


class AchievementService:
    @staticmethod
    async def _matches(db: AsyncSession, criteria: dict, student_id: int, profile) -> bool:
        kind = criteria.get('type')

        if kind == AchievementCriteriaType.experiment_completed.value:
            slug = criteria.get('experiment_slug')
            experiment = await experiment_dao.get_by_slug(db, slug) if slug else None
            if experiment is None:
                return False
            state = await student_experiment_dao.get(db, student_id, experiment.id)
            return state is not None and state.status == ExperimentStatusType.completed.value

        if kind == AchievementCriteriaType.lab_completed.value:
            lab = await lab_dao.get_by_slug(db, criteria.get('lab_slug', ''))
            if lab is None:
                return False
            experiments = await experiment_dao.get_by_lab(db, lab.id)
            if not experiments:
                return False
            done = await student_experiment_dao.completed_experiment_ids(db, student_id)
            return all(experiment.id in done for experiment in experiments)

        if kind == AchievementCriteriaType.total_xp.value:
            return profile.total_xp >= int(criteria.get('value', 0))

        if kind == AchievementCriteriaType.experiment_count.value:
            done = await student_experiment_dao.completed_experiment_ids(db, student_id)
            return len(done) >= int(criteria.get('value', 0))

        if kind == AchievementCriteriaType.perfect_score.value:
            needed = int(criteria.get('count', 1))
            states = await student_experiment_dao.get_all_for_student(db, student_id)
            perfect = sum(1 for state in states if state.best_score >= 100)
            return perfect >= needed

        return False

    async def evaluate(self, db: AsyncSession, profile) -> list[dict]:
        """Unlock every newly-earned badge and return them.

        Runs inside the caller's transaction so a submission and the badges it
        triggers commit together - a student never sees XP without the badge.
        """
        catalogue = await achievement_dao.get_all_active(db)
        already = await student_achievement_dao.unlocked_ids(db, profile.id)

        unlocked: list[dict] = []
        for achievement in catalogue:
            if achievement.id in already:
                continue
            if not await self._matches(db, achievement.criteria or {}, profile.id, profile):
                continue
            await student_achievement_dao.unlock(db, profile.id, achievement.id)
            if achievement.xp_reward:
                profile.total_xp += achievement.xp_reward
                db.add(profile)
            unlocked.append(
                {
                    'slug': achievement.slug,
                    'name': achievement.name,
                    'icon': achievement.icon,
                    'xp_reward': achievement.xp_reward,
                }
            )
        if unlocked:
            await db.flush()
        return unlocked


achievement_service = AchievementService()
