"""link recommendations to events, satellite observations and crops

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-15
"""

from alembic import op
import sqlalchemy as sa


revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recommendation_event",
        sa.Column(
            "recommendation_id",
            sa.Integer(),
            sa.ForeignKey("recommendation.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "event_id",
            sa.Integer(),
            sa.ForeignKey("event.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_index("idx_recommendation_event_event", "recommendation_event", ["event_id"])
    op.create_table(
        "recommendation_satellite_observation",
        sa.Column(
            "recommendation_id",
            sa.Integer(),
            sa.ForeignKey("recommendation.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "satellite_observation_id",
            sa.Integer(),
            sa.ForeignKey("satellite_observation.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_index(
        "idx_recommendation_satellite_observation",
        "recommendation_satellite_observation",
        ["satellite_observation_id"],
    )
    op.create_table(
        "recommendation_crop",
        sa.Column(
            "recommendation_id",
            sa.Integer(),
            sa.ForeignKey("recommendation.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "crop_id",
            sa.Integer(),
            sa.ForeignKey("crop.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_index("idx_recommendation_crop_crop", "recommendation_crop", ["crop_id"])


def downgrade() -> None:
    op.drop_index("idx_recommendation_crop_crop", table_name="recommendation_crop")
    op.drop_table("recommendation_crop")
    op.drop_index(
        "idx_recommendation_satellite_observation",
        table_name="recommendation_satellite_observation",
    )
    op.drop_table("recommendation_satellite_observation")
    op.drop_index("idx_recommendation_event_event", table_name="recommendation_event")
    op.drop_table("recommendation_event")
