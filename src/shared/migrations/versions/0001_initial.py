"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-11-14
"""

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geography

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "station",
        sa.Column("id", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("unique_identifier", sa.String(64), nullable=False, unique=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )

    op.create_table(
        "measure",
        sa.Column("id", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("station_id", sa.Integer(), sa.ForeignKey("station.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("sensor_name", sa.String(64), nullable=False),
        sa.Column("measurement_unit", sa.String(32), nullable=False),
        sa.Column("data_type", sa.String(32), nullable=False),
    )
    op.create_index("idx_measure_station", "measure", ["station_id"])

    op.create_table(
        "event",
        sa.Column("id", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("timestamp", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("station_id", sa.Integer(), sa.ForeignKey("station.id", ondelete="CASCADE"), nullable=False),
        sa.Column("measure_id", sa.Integer(), sa.ForeignKey("measure.id", ondelete="CASCADE"), nullable=False),
        sa.Column("measure_type", sa.String(64), nullable=False),
        sa.Column("value", sa.String(64), nullable=False),
    )
    op.create_index("idx_event_station", "event", ["station_id"])
    op.create_index("idx_event_measure", "event", ["measure_id"])
    op.create_index("idx_event_timestamp", "event", ["timestamp"])

    op.create_table(
        "property",
        sa.Column("id", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("lat", sa.Double(), nullable=False),
        sa.Column("lng", sa.Double(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
    )

    op.create_table(
        "crop",
        sa.Column("id", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
    )

    op.create_table(
        "field",
        sa.Column("id", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("property_id", sa.Integer(), sa.ForeignKey("property.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(128), nullable=True),
        sa.Column("geometry", Geography(geometry_type="POLYGON", srid=4326), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
    )
    op.create_index("idx_field_property", "field", ["property_id"])

    op.create_table(
        "planting",
        sa.Column("id", sa.Integer(), sa.Identity(always=True), primary_key=True),
        sa.Column("field_id", sa.Integer(), sa.ForeignKey("field.id", ondelete="CASCADE"), nullable=False),
        sa.Column("crop_id", sa.Integer(), sa.ForeignKey("crop.id"), nullable=False),
        sa.Column("planting_date", sa.Date(), nullable=False),
        sa.Column("harvest_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
    )
    op.create_index("idx_planting_field", "planting", ["field_id"])
    op.create_index("idx_planting_crop", "planting", ["crop_id"])

    op.create_table(
        "rotation_rule",
        sa.Column("previous_crop_id", sa.Integer(), sa.ForeignKey("crop.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("suggested_crop_id", sa.Integer(), sa.ForeignKey("crop.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("priority", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("deleted", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
        sa.CheckConstraint("previous_crop_id <> suggested_crop_id"),
    )


def downgrade() -> None:
    op.drop_table("rotation_rule")
    op.drop_table("planting")
    op.drop_table("field")
    op.drop_table("crop")
    op.drop_table("property")
    op.drop_table("event")
    op.drop_table("measure")
    op.drop_table("station")
    op.execute("DROP EXTENSION IF EXISTS postgis")
