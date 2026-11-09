from pydantic import BaseModel, ConfigDict, Field, ValidationError

from services.core.games.discovery import DiscoveryError


class LastRating(BaseModel):
    model_config = ConfigDict(strict=True)
    rating: int = Field(ge=0, le=10000)


class TimeControlStats(BaseModel):
    model_config = ConfigDict(strict=True)
    last: LastRating | None = None


class ProviderRatings(BaseModel):
    model_config = ConfigDict(strict=True)
    chess_rapid: TimeControlStats | None = None
    chess_blitz: TimeControlStats | None = None
    chess_bullet: TimeControlStats | None = None


def player_ratings(payload: object) -> dict[str, int | None]:
    try:
        stats = ProviderRatings.model_validate(payload)
    except ValidationError:
        raise DiscoveryError(
            "invalid_data", "The provider returned invalid player ratings.", 502
        ) from None
    return {
        name: control.last.rating if control and control.last else None
        for name, control in (
            ("rapid", stats.chess_rapid),
            ("blitz", stats.chess_blitz),
            ("bullet", stats.chess_bullet),
        )
    }
