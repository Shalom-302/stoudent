"""notifications, thanks, edits

Revision ID: c9e5a1b3d4f6
Revises: b8d4f0a2c3e5
Create Date: 2026-10-28 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9e5a1b3d4f6'
down_revision: Union[str, None] = 'b8d4f0a2c3e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Notifications, "Merci" on answers, and an edit marker on posts.

    Idempotent: on a fresh database the community tables come from create_all
    at startup, already in their final shape.
    """
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table('question'):
        return

    question_cols = {c['name'] for c in inspector.get_columns('question')}
    if 'edited_at' not in question_cols:
        op.add_column('question', sa.Column('edited_at', sa.DateTime(timezone=True), nullable=True))
    if 'answer_notified_at' not in question_cols:
        op.add_column('question', sa.Column('answer_notified_at', sa.DateTime(timezone=True), nullable=True))
    answer_cols = {c['name'] for c in inspector.get_columns('answer')}
    if 'thanks_count' not in answer_cols:
        op.add_column('answer', sa.Column('thanks_count', sa.Integer(), nullable=False, server_default='0'))
    if 'edited_at' not in answer_cols:
        op.add_column('answer', sa.Column('edited_at', sa.DateTime(timezone=True), nullable=True))

    from backend.models.community import Notification

    Notification.__table__.create(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    op.drop_table('notification', if_exists=True)
    op.drop_column('answer', 'edited_at')
    op.drop_column('answer', 'thanks_count')
    op.drop_column('question', 'edited_at')
    op.drop_column('question', 'answer_notified_at')
