"""student_experiment milestones

Revision ID: 33e1941ea17a
Revises: 64524c63b666
Create Date: 2026-09-18 18:32:34.369635

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '33e1941ea17a'
down_revision: Union[str, None] = '64524c63b666'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Latched record of the manipulations a student has performed.

    A TP is graded on what was done at the bench, so reaching a state once has
    to survive the student moving the knob back. Written by hand: the column
    was already applied to the dev database when autogenerate ran, so it saw no
    difference to describe.
    """
    op.add_column(
        'student_experiment',
        sa.Column(
            'milestones',
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column('student_experiment', 'milestones')
