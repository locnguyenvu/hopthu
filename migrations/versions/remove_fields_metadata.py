"""Remove fields_metadata column from templates table.

Revision ID: remove_fields_metadata
Revises: add_fields_metadata
Create Date: 2026-04-06 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'remove_fields_metadata'
down_revision = 'add_fields_metadata'
branch_labels = None
depends_on = None


def upgrade():
    # Remove fields_metadata column from templates table
    op.drop_column('templates', 'fields_metadata')


def downgrade():
    # Re-add fields_metadata column
    op.add_column('templates', sa.Column('fields_metadata', sa.JSON(), nullable=True))
