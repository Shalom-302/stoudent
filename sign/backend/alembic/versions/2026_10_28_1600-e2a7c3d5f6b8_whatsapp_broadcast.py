"""whatsapp broadcast

Revision ID: e2a7c3d5f6b8
Revises: d1f6b2c4e5a7
Create Date: 2026-10-28 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2a7c3d5f6b8'
down_revision: Union[str, None] = 'd1f6b2c4e5a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """WhatsApp announcements from SignManager.

    Idempotent: on a fresh database the table comes from create_all at startup.
    """
    if not sa.inspect(op.get_bind()).has_table('user'):
        return
    from backend.models.broadcast import Broadcast

    Broadcast.__table__.create(op.get_bind(), checkfirst=True)
    cols = {c['name'] for c in sa.inspect(op.get_bind()).get_columns('broadcast')}
    if 'error' not in cols:
        op.add_column('broadcast', sa.Column('error', sa.String(300), nullable=True))


def downgrade() -> None:
    op.drop_table('broadcast', if_exists=True)
