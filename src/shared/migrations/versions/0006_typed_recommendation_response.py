"""store typed and extensible model responses in recommendation

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
    op.add_column("recommendation", sa.Column("question_id", sa.String(255), nullable=True))
    op.add_column("recommendation", sa.Column("model_name", sa.String(128), nullable=True))
    op.add_column("recommendation", sa.Column("instructions", sa.Text(), nullable=True))
    op.add_column("recommendation", sa.Column("criteria", sa.JSON(), nullable=True))
    op.add_column("recommendation", sa.Column("input_state", sa.JSON(), nullable=True))
    op.add_column("recommendation", sa.Column("choice", sa.Text(), nullable=True))
    op.add_column("recommendation", sa.Column("score", sa.Float(), nullable=True))
    op.add_column("recommendation", sa.Column("noul", sa.Float(), nullable=True))
    op.add_column("recommendation", sa.Column("confidence", sa.Float(), nullable=True))
    op.add_column("recommendation", sa.Column("probabilities", sa.JSON(), nullable=True))
    op.add_column("recommendation", sa.Column("legend", sa.JSON(), nullable=True))
    op.add_column("recommendation", sa.Column("response_data", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("recommendation", "response_data")
    op.drop_column("recommendation", "legend")
    op.drop_column("recommendation", "probabilities")
    op.drop_column("recommendation", "confidence")
    op.drop_column("recommendation", "noul")
    op.drop_column("recommendation", "score")
    op.drop_column("recommendation", "choice")
    op.drop_column("recommendation", "input_state")
    op.drop_column("recommendation", "criteria")
    op.drop_column("recommendation", "instructions")
    op.drop_column("recommendation", "model_name")
    op.drop_column("recommendation", "question_id")
