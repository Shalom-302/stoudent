"""resource library: kind, chapter, session, author, status

Revision ID: d1f6b2c4e5a7
Revises: c9e5a1b3d4f6
Create Date: 2026-10-28 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1f6b2c4e5a7'
down_revision: Union[str, None] = 'c9e5a1b3d4f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Resources become a library of BTS sujets, corrigés, cours and TD.

    Idempotent: on a fresh database the table comes from create_all at
    startup, already in its final shape.
    """
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table('resource'):
        return

    cols = {c['name'] for c in inspector.get_columns('resource')}
    if 'kind' not in cols:
        op.add_column('resource', sa.Column('kind', sa.String(20), nullable=False, server_default='autre'))
        op.create_index('ix_resource_kind', 'resource', ['kind'])
    if 'chapter' not in cols:
        op.add_column('resource', sa.Column('chapter', sa.String(150), nullable=True))
    if 'session_year' not in cols:
        op.add_column('resource', sa.Column('session_year', sa.SmallInteger(), nullable=True))
        op.create_index('ix_resource_session_year', 'resource', ['session_year'])
    if 'original_author' not in cols:
        op.add_column('resource', sa.Column('original_author', sa.String(150), nullable=True))
    if 'status' not in cols:
        op.add_column('resource', sa.Column('status', sa.String(20), nullable=False, server_default='published'))
        op.create_index('ix_resource_status', 'resource', ['status'])
    if 'open_count' not in cols:
        op.add_column('resource', sa.Column('open_count', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('resource', 'open_count')
    op.drop_index('ix_resource_status', table_name='resource')
    op.drop_column('resource', 'status')
    op.drop_column('resource', 'original_author')
    op.drop_index('ix_resource_session_year', table_name='resource')
    op.drop_column('resource', 'session_year')
    op.drop_column('resource', 'chapter')
    op.drop_index('ix_resource_kind', table_name='resource')
    op.drop_column('resource', 'kind')
