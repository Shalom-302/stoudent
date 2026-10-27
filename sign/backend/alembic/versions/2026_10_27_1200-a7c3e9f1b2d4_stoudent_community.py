"""stoudent community

Revision ID: a7c3e9f1b2d4
Revises: 6012924f490d
Create Date: 2026-10-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c3e9f1b2d4'
down_revision: Union[str, None] = '6012924f490d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table)


def _columns(table: str) -> set[str]:
    return {c['name'] for c in sa.inspect(op.get_bind()).get_columns(table)}


def _indexes(table: str) -> set[str]:
    return {i['name'] for i in sa.inspect(op.get_bind()).get_indexes(table)}


def upgrade() -> None:
    """STOUDENT: phone-first accounts, WhatsApp OTP, and the community tables.

    Written by hand and idempotent: the app runs ``create_all`` at startup, so
    the new tables may already exist when this runs - only the changes to
    existing tables are guaranteed to be missing.
    """
    # -- user: the WhatsApp number becomes the identifier ----------------------
    user_cols = _columns('user')
    op.alter_column('user', 'email', existing_type=sa.String(200), nullable=True)
    if 'pseudo' not in user_cols:
        op.add_column('user', sa.Column('pseudo', sa.String(40), nullable=True))
        op.create_index('ix_user_pseudo', 'user', ['pseudo'], unique=True)
    if 'email_verified' not in user_cols:
        # True for every existing account: nobody gets locked out by the gate.
        op.add_column('user', sa.Column('email_verified', sa.Boolean(), nullable=False, server_default='1'))
    if 'ix_user_phone' in _indexes('user'):
        op.drop_index('ix_user_phone', table_name='user')
    op.create_index('ix_user_phone', 'user', ['phone'], unique=True)

    # -- student_profile: filière, declared role, reputation -------------------
    # On a fresh database the SignalLab tables do not exist yet: they are made
    # by create_all at startup (after this runs), already with these columns.
    if _has_table('student_profile'):
        profile_cols = _columns('student_profile')
        if 'filiere' not in profile_cols:
            op.add_column('student_profile', sa.Column('filiere', sa.String(100), nullable=True))
            op.create_index('ix_student_profile_filiere', 'student_profile', ['filiere'])
        if 'member_type' not in profile_cols:
            op.add_column(
                'student_profile',
                sa.Column('member_type', sa.String(20), nullable=False, server_default='student'),
            )
        if 'reputation' not in profile_cols:
            op.add_column(
                'student_profile', sa.Column('reputation', sa.Integer(), nullable=False, server_default='0')
            )

    # -- the 'teacher' role, granted from SignManager --------------------------
    op.execute(
        "INSERT INTO role (x_id, name, status, created_time) "
        "SELECT substr(md5(random()::text), 1, 26), 'teacher', 1, now() "
        "WHERE NOT EXISTS (SELECT 1 FROM role WHERE name = 'teacher')"
    )

    # -- community tables ------------------------------------------------------
    # Same reason: on a fresh database these are left to create_all.
    if not _has_table('student_profile'):
        return
    from backend.models.community import Answer, Question, Report, Resource, Vote

    tables = [m.__table__ for m in (Question, Answer, Vote, Resource, Report)]
    tables[0].metadata.create_all(op.get_bind(), tables=tables, checkfirst=True)


def downgrade() -> None:
    for table in ('report', 'resource', 'vote'):
        op.drop_table(table, if_exists=True)
    op.execute('ALTER TABLE IF EXISTS question DROP CONSTRAINT IF EXISTS question_accepted_answer_id_fkey')
    op.drop_table('answer', if_exists=True)
    op.drop_table('question', if_exists=True)
    op.execute("DELETE FROM role WHERE name = 'teacher'")
    op.drop_column('student_profile', 'reputation')
    op.drop_column('student_profile', 'member_type')
    op.drop_index('ix_student_profile_filiere', table_name='student_profile')
    op.drop_column('student_profile', 'filiere')
    op.drop_index('ix_user_phone', table_name='user')
    op.create_index('ix_user_phone', 'user', ['phone'], unique=False)
    op.drop_column('user', 'email_verified')
    op.drop_index('ix_user_pseudo', table_name='user')
    op.drop_column('user', 'pseudo')
    # Phone-only accounts have no email: they must be removed before this.
    op.alter_column('user', 'email', existing_type=sa.String(200), nullable=False)
