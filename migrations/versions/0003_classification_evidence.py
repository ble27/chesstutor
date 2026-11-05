"""Persist move reviews and charge verification before starting additional work."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "analyses",
        sa.Column("verification_reserved_ms", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_check_constraint(
        "ck_verification_reserved_nonnegative", "analyses", "verification_reserved_ms >= 0"
    )
    op.add_column("analysis_evidence", sa.Column("move_review", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("analysis_evidence", "move_review")
    op.drop_constraint("ck_verification_reserved_nonnegative", "analyses", type_="check")
    op.drop_column("analyses", "verification_reserved_ms")
