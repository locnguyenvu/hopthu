"""Add fields_metadata column to templates table.

Revision ID: add_fields_metadata
Revises: 736587dbf37d
Create Date: 2026-04-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_fields_metadata'
down_revision = '736587dbf37d'
branch_labels = None
depends_on = None


def upgrade():
    # Add fields_metadata column to templates table
    op.add_column('templates', sa.Column('fields_metadata', sa.JSON(), nullable=True))


def downgrade():
    # Remove fields_metadata column
    op.drop_column('templates', 'fields_metadata')
