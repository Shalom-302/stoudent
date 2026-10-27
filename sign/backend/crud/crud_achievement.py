"""Data access for badges and their unlock records."""
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from backend.crud.crud_base import CRUDBase
from backend.models import Achievement, StudentAchievement


class CRUDAchievement(CRUDBase[Achievement]):
    async def get_all_active(self, db: AsyncSession) -> Sequence[Achievement]:
        stmt = (
            select(self.model)
            .where(self.model.is_active.is_(True))
            .order_by(self.model.id)
        )
        result = await db.execute(stmt)
        return result.unique().scalars().all()

    async def get_by_slug(self, db: AsyncSession, slug: str) -> Achievement | None:
        return await self.select_model_by_column(db, slug=slug)


class CRUDStudentAchievement(CRUDBase[StudentAchievement]):
    async def get_all_for_student(
        self, db: AsyncSession, student_id: int
    ) -> Sequence[StudentAchievement]:
        stmt = (
            select(self.model)
            .where(self.model.student_id == student_id)
            .options(joinedload(self.model.achievement))
            .order_by(self.model.unlocked_at.desc())
        )
        result = await db.execute(stmt)
        return result.unique().scalars().all()

    async def unlocked_ids(self, db: AsyncSession, student_id: int) -> set[int]:
        stmt = select(self.model.achievement_id).where(self.model.student_id == student_id)
        result = await db.execute(stmt)
        return set(result.scalars().all())

    async def unlock(
        self, db: AsyncSession, student_id: int, achievement_id: int
    ) -> StudentAchievement:
        row = StudentAchievement(student_id=student_id, achievement_id=achievement_id)
        db.add(row)
        await db.flush()
        return row


achievement_dao: CRUDAchievement = CRUDAchievement(Achievement)
student_achievement_dao: CRUDStudentAchievement = CRUDStudentAchievement(StudentAchievement)
