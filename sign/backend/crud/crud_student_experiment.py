"""Data access for per-student experiment state (MyLab saves)."""
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from backend.crud.crud_base import CRUDBase
from backend.models import Experiment, StudentExperiment


class CRUDStudentExperiment(CRUDBase[StudentExperiment]):
    async def get(
        self, db: AsyncSession, student_id: int, experiment_id: int
    ) -> StudentExperiment | None:
        stmt = select(self.model).where(
            self.model.student_id == student_id,
            self.model.experiment_id == experiment_id,
        )
        result = await db.execute(stmt)
        return result.unique().scalars().first()

    async def get_or_create(
        self, db: AsyncSession, student_id: int, experiment_id: int
    ) -> StudentExperiment:
        existing = await self.get(db, student_id, experiment_id)
        if existing is not None:
            return existing
        state = StudentExperiment(student_id=student_id, experiment_id=experiment_id)
        db.add(state)
        await db.flush()
        return state

    async def get_all_for_student(
        self, db: AsyncSession, student_id: int
    ) -> Sequence[StudentExperiment]:
        stmt = (
            select(self.model)
            .where(self.model.student_id == student_id)
            .options(joinedload(self.model.experiment))
            .order_by(self.model.updated_time.desc().nullslast())
        )
        result = await db.execute(stmt)
        return result.unique().scalars().all()

    async def get_history(
        self, db: AsyncSession, student_id: int, limit: int = 20
    ) -> Sequence[StudentExperiment]:
        """Most recently touched experiments, for the dashboard "continue" row."""
        stmt = (
            select(self.model)
            .where(self.model.student_id == student_id)
            .options(joinedload(self.model.experiment).joinedload(Experiment.lab))
            .order_by(self.model.updated_time.desc().nullslast(), self.model.id.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        return result.unique().scalars().all()

    async def completed_experiment_ids(self, db: AsyncSession, student_id: int) -> set[int]:
        from backend.common.enums import ExperimentStatusType

        stmt = select(self.model.experiment_id).where(
            self.model.student_id == student_id,
            self.model.status == ExperimentStatusType.completed.value,
        )
        result = await db.execute(stmt)
        return set(result.scalars().all())


student_experiment_dao: CRUDStudentExperiment = CRUDStudentExperiment(StudentExperiment)
