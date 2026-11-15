"""crop catalog (Embrapa planting table)

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-15
"""

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("crop", sa.Column("slug", sa.String(64), nullable=True))
    op.add_column("crop", sa.Column("botanical_family", sa.String(64), nullable=True))
    op.add_column("crop", sa.Column("crop_group", sa.String(32), nullable=True))
    op.add_column("crop", sa.Column("emoji", sa.String(16), nullable=True))
    op.add_column("crop", sa.Column("row_spacing_centimeters", sa.Integer(), nullable=True))
    op.add_column("crop", sa.Column("plant_spacing_centimeters", sa.Integer(), nullable=True))
    op.add_column("crop", sa.Column("planting_type", sa.String(128), nullable=True))
    op.add_column("crop", sa.Column("harvest_days_min", sa.Integer(), nullable=True))
    op.add_column("crop", sa.Column("harvest_days_max", sa.Integer(), nullable=True))
    op.add_column("crop", sa.Column("production_per_square_meter", sa.String(64), nullable=True))
    op.add_column("crop", sa.Column("source", sa.String(32), nullable=True))
    op.create_unique_constraint("uq_crop_slug", "crop", ["slug"])

    op.create_table(
        "crop_planting_window",
        sa.Column("crop_id", sa.Integer(), sa.ForeignKey("crop.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("region", sa.String(16), primary_key=True),
        sa.Column("month", sa.SmallInteger(), primary_key=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.CheckConstraint("month BETWEEN 1 AND 12"),
    )


def downgrade() -> None:
    op.drop_table("crop_planting_window")
    op.drop_constraint("uq_crop_slug", "crop", type_="unique")
    for column in (
        "source", "production_per_square_meter", "harvest_days_max", "harvest_days_min", "planting_type",
        "plant_spacing_centimeters", "row_spacing_centimeters", "emoji", "crop_group", "botanical_family", "slug",
    ):
        op.drop_column("crop", column)
