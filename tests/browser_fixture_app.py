"""Local-only Playwright fixture: real chess validation, no database or engine job."""

import httpx

from services.adapters.pubapi import PubAPI
from services.api.app.main import create_app
from services.api.app.settings import Settings
from services.application.discovery import Discovery
from tests.unit.analysis_fakes import Service
from tests.unit.browser_fakes import browser_game
from tests.unit.discovery_fakes import MemoryCache, MemoryStore
from tests.unit.test_health import FakeProbe

store = MemoryStore()
game = browser_game()
store.games[game.game.id] = game
client = httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(503)))
discovery = Discovery(PubAPI(client, MemoryCache(), "ChessTutor fixture"), store)
app = create_app(
    Settings(_env_file=None, allowed_origins=("http://127.0.0.1:5174",)),
    FakeProbe(True),
    discovery,
    Service(),
)
