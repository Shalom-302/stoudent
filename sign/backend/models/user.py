import sqlalchemy as sa
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql.functions import current_timestamp
from sqlalchemy import func

from datetime import datetime


from backend.common.model import Base, id_key, get_id
from backend.utils.timezone import timezone
from .associations import user_role



class User(Base):
    id: Mapped[id_key] = mapped_column(init=False)
    x_id: Mapped[str] = mapped_column(sa.String(32), init=False, unique=True, default=get_id)
    firstname: Mapped[str] = mapped_column(sa.String, init=False, nullable=True)
    lastname: Mapped[str] = mapped_column(sa.String, init=False, index=True, nullable=True)
    # STOUDENT: the WhatsApp number is the account identifier (digits only,
    # country code included). Nullable + unique: Postgres allows several NULLs,
    # so accounts created before the switch (email only) remain valid.
    phone: Mapped[str | None] = mapped_column(sa.String, init=False, index=True, unique=True, nullable=True, default=None)
    # Public name shown on questions and answers.
    pseudo: Mapped[str | None] = mapped_column(sa.String(40), init=False, index=True, unique=True, nullable=True, default=None)
    # Optional since STOUDENT: the phone is enough to sign up.
    email: Mapped[str | None] = mapped_column(sa.String(200), init=False, index=True, unique=True, nullable=True, default=None)
    password: Mapped[str] = mapped_column(sa.String, nullable=False)
    salt: Mapped[str] = mapped_column(sa.String, nullable=True)
    status: Mapped[bool] = mapped_column(sa.Boolean, default=True, server_default='1')  # User account status (False: deactivated, True: normal)
    # WhatsApp-OTP sign-up gate (ported from shaapi). server_default True so every
    # pre-existing account stays verified and is never locked out; only new
    # self-service registrations are created with this False.
    email_verified: Mapped[bool] = mapped_column(sa.Boolean, init=False, default=True, server_default='1')
    is_multi_login: Mapped[bool] = mapped_column(sa.Boolean(), nullable=False, default=False, server_default='1')
    last_login_time: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), init=False, onupdate=func.now(), default=current_timestamp())
    join_time: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), init=False, default=current_timestamp())

    # User related roles 
    roles: Mapped[list["Role"]] = relationship(secondary=user_role, init=False, lazy="joined")