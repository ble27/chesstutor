"""Durable analysis jobs and per-ply evidence; reversible without changing games."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analyses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("game_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner", sa.String(64), nullable=False),
        sa.Column("ip_digest", sa.String(64), nullable=False),
        sa.Column("cache_key", sa.String(64), nullable=False),
        sa.Column("mode", sa.String(8), nullable=False),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("game_data", postgresql.JSONB(), nullable=False),
        sa.Column("engine", postgresql.JSONB(), nullable=False),
        sa.Column("token", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("completed_plies", sa.Integer(), nullable=False),
        sa.Column("total_plies", sa.Integer(), nullable=False),
        sa.Column("dispatch_pending", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("heartbeat", sa.DateTime(timezone=True)),
        sa.Column("deadline_at", sa.DateTime(timezone=True)),
        sa.Column("error_code", sa.String(40)),
    )
    op.create_index("ix_analyses_cache", "analyses", ["cache_key", "state"])
    op.create_index("ix_analyses_owner", "analyses", ["owner", "created_at"])
    op.create_index("ix_analyses_ip", "analyses", ["ip_digest", "created_at"])
    op.create_table(
        "analysis_evidence",
        sa.Column(
            "analysis_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("analyses.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("ply", sa.Integer(), primary_key=True),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("analysis_evidence")
    op.drop_table("analyses")
