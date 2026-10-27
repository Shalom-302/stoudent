"""Data access for the student profile and their avatar."""
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from backend.crud.crud_base import CRUDBase
from backend.models import Avatar, StudentProfile


class CRUDStudentProfile(CRUDBase[StudentProfile]):
    async def get_by_user_id(self, db: AsyncSession, user_id: int) -> StudentProfile | None:
        stmt = (
            select(self.model)
            .where(self.model.user_id == user_id)
            .options(joinedload(self.model.user), joinedload(self.model.avatar))
        )
        result = await db.execute(stmt)
        return result.unique().scalars().first()

    async def get_by_x_id(self, db: AsyncSession, x_id: str) -> StudentProfile | None:
        stmt = (
            select(self.model)
            .where(self.model.x_id == x_id)
            .options(joinedload(self.model.user), joinedload(self.model.avatar))
        )
        result = await db.execute(stmt)
        return result.unique().scalars().first()

    async def create_for_user(self, db: AsyncSession, user_id: int) -> StudentProfile:
        """Create the profile lazily on first access, race-free.

        Registration goes through the shared auth service, so the SignalLab
        profile is materialised the first time the student touches a lab
        endpoint instead of forking the auth flow.

        A fresh session opens several lab endpoints at once (avatar, progress,
        lab detail), and every one of them finds no profile and tries to create
        it. A plain INSERT then loses the race with a unique-violation 500, so
        the insert is ON CONFLICT DO NOTHING and the row is read back: whoever
        won, everybody gets the same profile.
        """
        stmt = (
            pg_insert(StudentProfile.__table__)
            .values(user_id=user_id)
            .on_conflict_do_nothing(index_elements=['user_id'])
        )
        await db.execute(stmt)
        await db.flush()
        profile = await self.get_by_user_id(db, user_id)
        if profile is None:  # pragma: no cover - only if the row vanished
            raise RuntimeError(f'Student profile for user {user_id} could not be created')
        return profile

    async def add_xp(self, db: AsyncSession, profile: StudentProfile, xp: int) -> None:
        profile.total_xp = max(profile.total_xp + xp, 0)
        db.add(profile)


class CRUDAvatar(CRUDBase[Avatar]):
    async def get_by_student(self, db: AsyncSession, student_id: int) -> Avatar | None:
        return await self.select_model_by_column(db, student_id=student_id)

    async def create_default(self, db: AsyncSession, student_id: int) -> Avatar:
        """Same concurrency story as the profile: one avatar per student."""
        # `accessories` carries a dataclass `default_factory`, which the ORM
        # applies but a Core insert does not; passing it explicitly is what
        # keeps this path off a NOT NULL violation.
        stmt = (
            pg_insert(Avatar.__table__)
            .values(student_id=student_id, accessories=[])
            .on_conflict_do_nothing(index_elements=['student_id'])
        )
        await db.execute(stmt)
        await db.flush()
        avatar = await self.get_by_student(db, student_id)
        if avatar is None:  # pragma: no cover
            raise RuntimeError(f'Avatar for student {student_id} could not be created')
        return avatar


student_dao: CRUDStudentProfile = CRUDStudentProfile(StudentProfile)
avatar_dao: CRUDAvatar = CRUDAvatar(Avatar)
