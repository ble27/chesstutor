from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from services.adapters.game_store import metadata

analyses = Table(
    "analyses",
    metadata,
    Column("id", PG_UUID(as_uuid=True), primary_key=True),
    Column("game_id", PG_UUID(as_uuid=True), nullable=False),
    Column("owner", String(64), nullable=False),
    Column("ip_digest", String(64), nullable=False),
    Column("cache_key", String(64), nullable=False),
    Column("mode", String(8), nullable=False),
    Column("state", String(20), nullable=False),
    Column("game_data", JSONB, nullable=False),
    Column("engine", JSONB, nullable=False),
    Column("token", PG_UUID(as_uuid=True), nullable=False),
    Column("attempts", Integer, nullable=False),
    Column("completed_plies", Integer, nullable=False),
    Column("total_plies", Integer, nullable=False),
    Column("dispatch_pending", Boolean, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
    Column("heartbeat", DateTime(timezone=True)),
    Column("deadline_at", DateTime(timezone=True)),
    Column("error_code", String(40)),
)
Index("ix_analyses_cache", analyses.c.cache_key, analyses.c.state)
Index("ix_analyses_owner", analyses.c.owner, analyses.c.created_at)
Index("ix_analyses_ip", analyses.c.ip_digest, analyses.c.created_at)
reviews = Table(
    "analysis_evidence",
    metadata,
    Column(
        "analysis_id",
        PG_UUID(as_uuid=True),
        ForeignKey("analyses.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("ply", Integer, primary_key=True),
    Column("payload", JSONB, nullable=False),
)
