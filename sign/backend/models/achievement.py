"""Achievement: a badge unlocked by a measurable criterion."""
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from backend.common.model import Base, get_id, id_key


class Achievement(Base):
    """Badge definition.

    ``criteria`` is evaluated server-side after each submission, e.g.
    ``{"type": "experiment_completed", "experiment_slug": "serie-de-fourier"}``.
    """

    __tablename__ = 'achievement'

    id: Mapped[id_key] = mapped_column(init=False)
    x_id: Mapped[str] = mapped_column(sa.String(32), init=False, unique=True, default=get_id)
    name: Mapped[str] = mapped_column(sa.String(150))
    slug: Mapped[str] = mapped_column(sa.String(150), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(sa.Text, init=False, default=None)
    icon: Mapped[str] = mapped_column(sa.String(100), init=False, default='award')
    xp_reward: Mapped[int] = mapped_column(sa.Integer, init=False, default=0)
    criteria: Mapped[dict] = mapped_column(JSONB, init=False, default_factory=dict)
    is_active: Mapped[bool] = mapped_column(sa.Boolean, init=False, default=True)
