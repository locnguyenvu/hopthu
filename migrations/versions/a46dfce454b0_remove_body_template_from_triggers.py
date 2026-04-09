"""remove_body_template_from_triggers

Revision ID: a46dfce454b0
Revises: 8d40df50ca40
Create Date: 2026-04-10 14:20:30.311686

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a46dfce454b0'
down_revision: Union[str, Sequence[str], None] = '8d40df50ca40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('triggers', 'body_template')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('triggers', sa.Column('body_template', sa.JSON(), nullable=False, server_default='{}'))
