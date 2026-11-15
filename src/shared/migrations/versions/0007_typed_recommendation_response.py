"""store typed and extensible model responses in recommendation

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-15
"""

from alembic import op
import sqlalchemy as sa


revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


COLUMNS = [
    ("question_id", sa.String(255)),
    ("model_name", sa.String(128)),
    ("instructions", sa.Text()),
    ("criteria", sa.JSON()),
    ("input_state", sa.JSON()),
    ("choice", sa.Text()),
    ("score", sa.Float()),
    ("noul", sa.Float()),
    ("confidence", sa.Float()),
    ("probabilities", sa.JSON()),
    ("legend", sa.JSON()),
    ("response_data", sa.JSON()),
]


def upgrade() -> None:
    existing = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("recommendation")}
    for name, type_ in COLUMNS:
        if name not in existing:
            op.add_column("recommendation", sa.Column(name, type_, nullable=True))


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
