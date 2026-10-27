"""Data access for labs and experiments (the catalogue side)."""
from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.crud.crud_base import CRUDBase
from backend.models import Experiment, Lab


class CRUDLab(CRUDBase[Lab]):
    async def get_all_active(self, db: AsyncSession) -> Sequence[Lab]:
        stmt = (
            select(self.model)
            .where(self.model.is_active.is_(True))
            .order_by(self.model.order, self.model.id)
        )
        result = await db.execute(stmt)
        return result.unique().scalars().all()

    async def get_by_slug(self, db: AsyncSession, slug: str) -> Lab | None:
        stmt = (
            select(self.model)
            .where(self.model.slug == slug, self.model.is_active.is_(True))
            .options(selectinload(self.model.experiments))
        )
        result = await db.execute(stmt)
        return result.unique().scalars().first()

    async def count_experiments(self, db: AsyncSession) -> dict[int, int]:
        """``{lab_id: published experiment count}`` for the progress widgets."""
        stmt = (
            select(Experiment.lab_id, func.count(Experiment.id))
            .where(Experiment.is_published.is_(True))
            .group_by(Experiment.lab_id)
        )
        result = await db.execute(stmt)
        return {lab_id: count for lab_id, count in result.all()}


class CRUDExperiment(CRUDBase[Experiment]):
    async def get_by_slug(self, db: AsyncSession, slug: str) -> Experiment | None:
        stmt = (
            select(self.model)
            .where(self.model.slug == slug, self.model.is_published.is_(True))
        )
        result = await db.execute(stmt)
        return result.unique().scalars().first()

    async def get_by_x_id(self, db: AsyncSession, x_id: str) -> Experiment | None:
        stmt = select(self.model).where(self.model.x_id == x_id)
        result = await db.execute(stmt)
        return result.unique().scalars().first()

    async def get_by_lab(self, db: AsyncSession, lab_id: int) -> Sequence[Experiment]:
        stmt = (
            select(self.model)
            .where(self.model.lab_id == lab_id, self.model.is_published.is_(True))
            .order_by(self.model.order, self.model.id)
        )
        result = await db.execute(stmt)
        return result.unique().scalars().all()

    async def get_all_published(self, db: AsyncSession) -> Sequence[Experiment]:
        stmt = (
            select(self.model)
            .where(self.model.is_published.is_(True))
            .order_by(self.model.lab_id, self.model.order)
        )
        result = await db.execute(stmt)
        return result.unique().scalars().all()


lab_dao: CRUDLab = CRUDLab(Lab)
experiment_dao: CRUDExperiment = CRUDExperiment(Experiment)
