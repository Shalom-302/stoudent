"""whatsapp opt-in

Revision ID: b8d4f0a2c3e5
Revises: a7c3e9f1b2d4
Create Date: 2026-10-27 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8d4f0a2c3e5'
down_revision: Union[str, None] = 'a7c3e9f1b2d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Consent to STOUDENT news on WhatsApp, timestamped.

    Idempotent, like the previous one: on a fresh database student_profile is
    made by create_all at startup, already with these columns.
    """
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table('student_profile'):
        return
    columns = {c['name'] for c in inspector.get_columns('student_profile')}
    if 'whatsapp_opt_in' not in columns:
        op.add_column(
            'student_profile',
            sa.Column('whatsapp_opt_in', sa.Boolean(), nullable=False, server_default='0'),
        )
        op.create_index('ix_student_profile_whatsapp_opt_in', 'student_profile', ['whatsapp_opt_in'])
    if 'whatsapp_opt_in_at' not in columns:
        op.add_column('student_profile', sa.Column('whatsapp_opt_in_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('student_profile', 'whatsapp_opt_in_at')
    op.drop_index('ix_student_profile_whatsapp_opt_in', table_name='student_profile')
    op.drop_column('student_profile', 'whatsapp_opt_in')
