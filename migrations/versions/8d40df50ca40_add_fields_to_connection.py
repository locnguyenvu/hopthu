"""add fields to connection

Revision ID: 8d40df50ca40
Revises: df52b23816c0
Create Date: 2026-04-10 00:14:17.603591

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8d40df50ca40'
down_revision: Union[str, Sequence[str], None] = 'df52b23816c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # SQLite requires special handling for NOT NULL columns on existing tables
    # 1. Add column as nullable
    op.add_column('connections', sa.Column('fields', sa.JSON(), nullable=True))
    
    # 2. Set default value for existing rows (empty JSON array)
    op.execute("UPDATE connections SET fields = '[]' WHERE fields IS NULL")
    
    # 3. Make column NOT NULL using batch_alter_table (SQLite workaround)
    with op.batch_alter_table('connections') as batch_op:
        batch_op.alter_column('fields', nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('connections') as batch_op:
        batch_op.drop_column('fields')
