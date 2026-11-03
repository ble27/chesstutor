import base64
import hashlib
import json
import re
from dataclasses import dataclass
from uuid import NAMESPACE_URL, uuid5


@dataclass
class DiscoveryError(Exception):
    code: str
    message: str
    status: int = 422
    retry_after_seconds: int | None = None


def username(value: str) -> str:
    normalized = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9_-]{3,25}", normalized):
        raise DiscoveryError(
            "invalid_username", "Use 3–25 letters, numbers, underscores or hyphens."
        )
    return normalized


def month_path(player: str, year: int, month: int) -> str:
    if not 2007 <= year <= 2100 or not 1 <= month <= 12:
        raise DiscoveryError("invalid_month", "Choose a valid archive month.")
    return f"/player/{username(player)}/games/{year:04d}/{month:02d}"


def source_url(value: str) -> str:
    match = re.fullmatch(r"https://(?:www\.)?chess\.com/game/(live|daily)/(\d{1,24})/?", value)
    if not match:
        raise DiscoveryError("invalid_data", "The provider returned an invalid game source.", 502)
    return f"https://www.chess.com/game/{match[1]}/{match[2]}"


def game_id(source: str) -> str:
    return str(uuid5(NAMESPACE_URL, source_url(source)))


def page_cursor(offset: int, context: str) -> str:
    payload = json.dumps(
        [offset, hashlib.sha256(context.encode()).hexdigest()], separators=(",", ":")
    )
    return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")


def cursor_offset(cursor: str | None, context: str) -> int:
    if cursor is None:
        return 0
    try:
        if len(cursor) > 200:
            raise ValueError
        data = json.loads(
            base64.b64decode(cursor + "=" * (-len(cursor) % 4), altchars=b"-_", validate=True)
        )
        if (
            not isinstance(data, list)
            or len(data) != 2
            or type(data[0]) is not int
            or data[0] < 0
            or data[0] % 20 != 0
            or data[1] != hashlib.sha256(context.encode()).hexdigest()
        ):
            raise ValueError
        return data[0]
    except ValueError, TypeError, UnicodeError:
        raise DiscoveryError("invalid_cursor", "Restart this month's game list.") from None
