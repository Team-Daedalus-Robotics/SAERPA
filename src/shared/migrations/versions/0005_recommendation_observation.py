"""store recommendation observations as measures

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-15
"""

from alembic import op
import sqlalchemy as sa


revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("recommendation", "observation", new_column_name="observation_text")
    op.create_table(
        "recommendation_observation",
        sa.Column(
            "recommendation_id",
            sa.Integer(),
            sa.ForeignKey("recommendation.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "measure_id",
            sa.Integer(),
            sa.ForeignKey("measure.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_index("idx_recommendation_observation_measure", "recommendation_observation", ["measure_id"])


def downgrade() -> None:
    op.drop_index("idx_recommendation_observation_measure", table_name="recommendation_observation")
    op.drop_table("recommendation_observation")
    op.alter_column("recommendation", "observation_text", new_column_name="observation")
