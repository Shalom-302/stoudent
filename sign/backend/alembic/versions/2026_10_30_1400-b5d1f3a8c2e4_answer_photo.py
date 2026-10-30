"""answer photo

Revision ID: b5d1f3a8c2e4
Revises: a4c9e2f7b1d3
Create Date: 2026-10-30 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5d1f3a8c2e4'
down_revision: Union[str, None] = 'a4c9e2f7b1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """An optional photo on an answer (a handwritten solution).

    Idempotent: on a fresh database the community tables come from create_all
    at startup, already in their final shape.
    """
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table('answer'):
        return
    if 'image_url' not in {c['name'] for c in inspector.get_columns('answer')}:
        op.add_column('answer', sa.Column('image_url', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('answer', 'image_url')
