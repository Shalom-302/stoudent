"""Avatar: the student's 3D appearance and last known world transform."""
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.common.model import Base, get_id, id_key


class Avatar(Base):
    """Cosmetic configuration plus the position we restore on reconnection.

    Storing the transform here is what lets a student pick the world back up
    where they left it: a single shared Babylon scene, per-student state in
    Postgres.
    """

    __tablename__ = 'avatar'

    id: Mapped[id_key] = mapped_column(init=False)
    x_id: Mapped[str] = mapped_column(sa.String(32), init=False, unique=True, default=get_id)
    student_id: Mapped[int] = mapped_column(
        sa.ForeignKey('student_profile.id', ondelete='CASCADE'), unique=True, index=True
    )
    model: Mapped[str] = mapped_column(sa.String(100), init=False, default='student_a')
    skin: Mapped[str] = mapped_column(sa.String(50), init=False, default='default')
    hair: Mapped[str] = mapped_column(sa.String(50), init=False, default='default')
    outfit: Mapped[str] = mapped_column(sa.String(50), init=False, default='lab_coat')
    accessories: Mapped[list] = mapped_column(JSONB, init=False, default_factory=list)
    position_x: Mapped[float] = mapped_column(sa.Float, init=False, default=0.0)
    position_y: Mapped[float] = mapped_column(sa.Float, init=False, default=0.0)
    position_z: Mapped[float] = mapped_column(sa.Float, init=False, default=0.0)
    rotation: Mapped[float] = mapped_column(sa.Float, init=False, default=0.0)

    student: Mapped['StudentProfile'] = relationship(init=False, back_populates='avatar')
