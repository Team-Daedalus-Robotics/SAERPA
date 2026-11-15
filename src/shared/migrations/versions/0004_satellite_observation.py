"""satellite_observation table

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-15
"""

from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "satellite_observation",
        sa.Column("id", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("source", sa.String(32), nullable=False),
        sa.Column("product", sa.String(64), nullable=False),
        sa.Column("variable", sa.String(64), nullable=False),
        sa.Column("depth", sa.String(32), nullable=True),
        sa.Column("measurement_unit", sa.String(32), nullable=False),
        sa.Column("observed_at", sa.Date(), nullable=False),
        sa.Column("requested_latitude", sa.Double(), nullable=True),
        sa.Column("requested_longitude", sa.Double(), nullable=True),
        sa.Column("cell_latitude", sa.Double(), nullable=True),
        sa.Column("cell_longitude", sa.Double(), nullable=True),
        sa.Column("value", sa.Double(), nullable=True),
        sa.Column("quality_flag", sa.SmallInteger(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.UniqueConstraint(
            "source",
            "product",
            "variable",
            "observed_at",
            "cell_latitude",
            "cell_longitude",
            name="satellite_observation_cell_key",
        ),
    )


def downgrade() -> None:
    op.drop_table("satellite_observation")
