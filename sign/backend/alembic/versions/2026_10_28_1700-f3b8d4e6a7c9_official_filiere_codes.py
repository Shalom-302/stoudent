"""official filière codes (DECO / MESRS)

Revision ID: f3b8d4e6a7c9
Revises: e2a7c3d5f6b8
Create Date: 2026-10-28 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3b8d4e6a7c9'
down_revision: Union[str, None] = 'e2a7c3d5f6b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# STOUDENT's first codes -> the official ones of bts.mesrs-ci.net.
RENAMES = {'FC': 'FCGE', 'GC': 'GEC', 'GCB': 'GBAT', 'MMA': '2MA', 'CJ': 'CJPI', 'SDI': 'SIN'}
TABLES = ('student_profile', 'question', 'resource')


def _rename(mapping: dict[str, str]) -> None:
    inspector = sa.inspect(op.get_bind())
    for table in TABLES:
        if not inspector.has_table(table):
            continue
        if 'filiere' not in {c['name'] for c in inspector.get_columns(table)}:
            continue
        for old, new in mapping.items():
            op.execute(sa.text(f'UPDATE {table} SET filiere = :new WHERE upper(filiere) = :old').bindparams(old=old, new=new))


def upgrade() -> None:
    """Align stored filières on the official list. Idempotent."""
    _rename(RENAMES)


def downgrade() -> None:
    _rename({new: old for old, new in RENAMES.items()})
