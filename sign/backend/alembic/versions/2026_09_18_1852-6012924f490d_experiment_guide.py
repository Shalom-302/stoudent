"""experiment guide

Revision ID: 6012924f490d
Revises: 33e1941ea17a
Create Date: 2026-09-18 18:52:33.623222

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '6012924f490d'
down_revision: Union[str, None] = '33e1941ea17a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Course material for a TP: the formula and a worked example.

    Handed to the student before they touch the bench - practice without the
    formula in hand is guesswork. Written by hand: the column was already
    applied to the dev database, so autogenerate saw nothing to describe.
    """
    # On a fresh database this table does not exist yet: create_all builds it
    # at startup (after the migrations), already with this column. Same when the
    # column is already there (dev databases where it was applied by hand).
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table('experiment') or 'guide' in {c['name'] for c in inspector.get_columns('experiment')}:
        return
    op.add_column(
        'experiment',
        sa.Column(
            'guide',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column('experiment', 'guide')
