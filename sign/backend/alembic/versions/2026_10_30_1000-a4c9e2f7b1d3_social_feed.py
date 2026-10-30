"""social feed: comments, share and comment counters

Revision ID: a4c9e2f7b1d3
Revises: f3b8d4e6a7c9
Create Date: 2026-10-30 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4c9e2f7b1d3'
down_revision: Union[str, None] = 'f3b8d4e6a7c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Comments under questions and answers, and the counters the feed shows.

    Idempotent: on a fresh database the community tables come from create_all
    at startup, already in their final shape.
    """
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table('question'):
        return

    question_cols = {c['name'] for c in inspector.get_columns('question')}
    for name in ('share_count', 'comment_count'):
        if name not in question_cols:
            op.add_column('question', sa.Column(name, sa.Integer(), nullable=False, server_default='0'))
    if 'comment_count' not in {c['name'] for c in inspector.get_columns('answer')}:
        op.add_column('answer', sa.Column('comment_count', sa.Integer(), nullable=False, server_default='0'))

    from backend.models.community import Comment

    Comment.__table__.create(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    op.drop_table('comment', if_exists=True)
    op.drop_column('answer', 'comment_count')
    op.drop_column('question', 'comment_count')
    op.drop_column('question', 'share_count')
