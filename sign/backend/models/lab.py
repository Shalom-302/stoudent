"""Lab: a building in the 3D campus that groups experiments."""
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.common.enums import LabStatusType, LabType
from backend.common.model import Base, get_id, id_key


class Lab(Base):
    """A virtual laboratory (SignalLab, TelecomLab...).

    ``scene_config`` is the Babylon.js payload the frontend needs to place the
    building and its equipment - kept as JSONB so the 3D scene can evolve
    without a migration.
    """

    __tablename__ = 'lab'

    id: Mapped[id_key] = mapped_column(init=False)
    x_id: Mapped[str] = mapped_column(sa.String(32), init=False, unique=True, default=get_id)
    name: Mapped[str] = mapped_column(sa.String(150), index=True)
    slug: Mapped[str] = mapped_column(sa.String(150), unique=True, index=True)
    type: Mapped[str] = mapped_column(sa.String(30), default=LabType.signal.value)
    description: Mapped[str | None] = mapped_column(sa.Text, init=False, default=None)
    status: Mapped[str] = mapped_column(
        sa.String(30), init=False, default=LabStatusType.available.value
    )
    thumbnail: Mapped[str | None] = mapped_column(sa.String(500), init=False, default=None)
    scene_config: Mapped[dict] = mapped_column(JSONB, init=False, default_factory=dict)
    order: Mapped[int] = mapped_column(sa.Integer, init=False, default=0)
    is_active: Mapped[bool] = mapped_column(sa.Boolean, init=False, default=True)

    experiments: Mapped[list['Experiment']] = relationship(
        init=False,
        back_populates='lab',
        cascade='all, delete-orphan',
        order_by='Experiment.order',
    )
