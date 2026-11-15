"""climate_cell: places whose NASA climate the nasa_event_worker keeps up to date

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-15
"""

from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "climate_cell",
        sa.Column("id", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("latitude", sa.Double(), nullable=False),
        sa.Column("longitude", sa.Double(), nullable=False),
        sa.Column("last_requested_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("last_attempt_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("last_refreshed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.UniqueConstraint("latitude", "longitude", name="uq_climate_cell_position"),
    )


def downgrade() -> None:
    op.drop_table("climate_cell")
