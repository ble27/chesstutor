from datetime import UTC, datetime
from uuid import uuid4

from services.api.app.analysis_schemas import AnalysisResponse
from services.core.analysis.values import AnalysisError


class Service:
    def __init__(self):
        self.owner, self.calls = None, []
        self.id, self.game_id = uuid4(), uuid4()

    def response(self):
        return AnalysisResponse(
            id=self.id,
            game_id=self.game_id,
            game_version=1,
            mode="quick",
            state="queued",
            completed_plies=0,
            total_plies=4,
            attempts=0,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            deadline_at=None,
            error_code=None,
            dispatch_pending=True,
            cached=False,
            can_cancel=True,
            engine={},
            evidence=[],
        )

    async def create(self, game_id, mode, owner, ip):
        self.owner = owner
        self.calls.append((game_id, mode, owner, ip))
        return self.response()

    async def cancel(self, identifier, owner):
        if owner != self.owner:
            raise AnalysisError(
                "not_owner", "Only the initiating session can cancel this analysis.", 403
            )
        return self.response()
