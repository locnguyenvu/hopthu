"""make trigger_log email_id nullable

Revision ID: df52b23816c0
Revises: c8da9b7c9ade
Create Date: 2026-04-09 15:10:01.249419

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'df52b23816c0'
down_revision: Union[str, Sequence[str], None] = 'c8da9b7c9ade'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # SQLite doesn't support ALTER COLUMN, use batch_alter_table
    with op.batch_alter_table('trigger_logs') as batch_op:
        batch_op.alter_column('email_id', nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('trigger_logs') as batch_op:
        batch_op.alter_column('email_id', nullable=False)