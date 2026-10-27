"""Lab catalogue as the student sees it, overlaid with their own progress."""
from __future__ import annotations

from backend.app.client.service.student_service import student_service
from backend.common.enums import ExperimentStatusType, LabStatusType
from backend.common.exception import errors
from backend.crud.crud_lab import experiment_dao, lab_dao
from backend.crud.crud_student_experiment import student_experiment_dao
from backend.database.db_postgres import async_db_session


class LabService:
    """Reads the catalogue and merges in the caller's state.

    Progressive unlocking lives here rather than in the model: an experiment is
    locked when the previous one in the same lab has not been completed, which
    is a rule about the *student*, not about the experiment row.
    """

    @staticmethod
    def _experiment_summary(experiment, state, is_locked: bool) -> dict:
        return {
            'x_id': experiment.x_id,
            'slug': experiment.slug,
            'title': experiment.title,
            'description': experiment.description,
            'difficulty': experiment.difficulty,
            'duration_minutes': experiment.duration_minutes,
            'xp_reward': experiment.xp_reward,
            'order': experiment.order,
            'status': state.status if state else ExperimentStatusType.not_started.value,
            'progress': state.progress if state else 0,
            'best_score': state.best_score if state else 0,
            'is_locked': is_locked,
        }

    async def get_labs(self, *, user_id: int) -> list[dict]:
        async with async_db_session.begin() as db:
            profile = await student_service.ensure_profile(db, user_id)
            labs = await lab_dao.get_all_active(db)
            counts = await lab_dao.count_experiments(db)
            completed_ids = await student_experiment_dao.completed_experiment_ids(db, profile.id)
            experiments = await experiment_dao.get_all_published(db)

            completed_per_lab: dict[int, int] = {}
            for experiment in experiments:
                if experiment.id in completed_ids:
                    completed_per_lab[experiment.lab_id] = (
                        completed_per_lab.get(experiment.lab_id, 0) + 1
                    )

            result = []
            for lab in labs:
                total = counts.get(lab.id, 0)
                completed = completed_per_lab.get(lab.id, 0)
                result.append(
                    {
                        'x_id': lab.x_id,
                        'name': lab.name,
                        'slug': lab.slug,
                        'type': lab.type,
                        'status': lab.status,
                        'description': lab.description,
                        'thumbnail': lab.thumbnail,
                        'order': lab.order,
                        'total_experiments': total,
                        'completed_experiments': completed,
                        'progress_percent': int(round(100 * completed / total)) if total else 0,
                    }
                )
            return result

    async def get_lab(self, *, user_id: int, slug: str) -> dict:
        async with async_db_session.begin() as db:
            profile = await student_service.ensure_profile(db, user_id)
            lab = await lab_dao.get_by_slug(db, slug)
            if lab is None:
                raise errors.NotFoundError(msg='Lab not found')

            experiments = await experiment_dao.get_by_lab(db, lab.id)
            states = {
                state.experiment_id: state
                for state in await student_experiment_dao.get_all_for_student(db, profile.id)
            }

            summaries = []
            # A coming-soon lab (TelecomLab in the MVP) shows its content but
            # never unlocks it; otherwise each TP opens once the previous is done.
            lab_open = lab.status == LabStatusType.available.value
            previous_done = True
            completed = 0
            for experiment in experiments:
                state = states.get(experiment.id)
                is_done = state is not None and state.status == ExperimentStatusType.completed.value
                completed += int(is_done)
                locked = not lab_open or not previous_done
                summaries.append(self._experiment_summary(experiment, state, locked))
                previous_done = is_done

            total = len(experiments)
            return {
                'x_id': lab.x_id,
                'name': lab.name,
                'slug': lab.slug,
                'type': lab.type,
                'status': lab.status,
                'description': lab.description,
                'thumbnail': lab.thumbnail,
                'order': lab.order,
                'scene_config': lab.scene_config or {},
                'total_experiments': total,
                'completed_experiments': completed,
                'progress_percent': int(round(100 * completed / total)) if total else 0,
                'experiments': summaries,
            }

    async def get_lab_experiments(self, *, user_id: int, slug: str) -> list[dict]:
        lab = await self.get_lab(user_id=user_id, slug=slug)
        return lab['experiments']

    async def get_world(self, *, user_id: int) -> dict:
        """Scene descriptor for the Babylon world: buildings + avatar state.

        One request on entering ``/world`` instead of three, because the 3D
        canvas should not wait on a waterfall before the first frame.
        """
        labs = await self.get_labs(user_id=user_id)
        avatar = await student_service.get_avatar(user_id=user_id)
        async with async_db_session.begin() as db:
            rows = await lab_dao.get_all_active(db)
            scenes = {row.slug: (row.scene_config or {}) for row in rows}
        for lab in labs:
            lab['scene_config'] = scenes.get(lab['slug'], {})
        return {'labs': labs, 'avatar': avatar}


lab_service = LabService()
