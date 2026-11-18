import asyncio

import httpx
import pytest

from services.adapters.coach_voice import CoachVoice
from services.core.analysis.values import AnalysisError


def test_voice_uses_allowlisted_provider_and_caches_reviewed_text() -> None:
    requests: list[httpx.Request] = []

    def provider(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200, stream=httpx.ByteStream(b"ID3 audio"), headers={"content-type": "audio/mpeg"}
        )

    voice = CoachVoice("test-key", transport=httpx.MockTransport(provider))
    assert asyncio.run(voice.speak("The knight attacks the queen.")) == b"ID3 audio"
    assert asyncio.run(voice.speak("The knight attacks the queen.")) == b"ID3 audio"
    assert len(requests) == 1
    request = requests[0]
    assert request.url.host == "api.elevenlabs.io"
    assert request.headers["xi-api-key"] == "test-key"
    assert b"eleven_multilingual_v2" in request.content


def test_voice_rejects_non_audio_and_disabled_provider() -> None:
    voice = CoachVoice(
        "test-key", transport=httpx.MockTransport(lambda _: httpx.Response(200, json={}))
    )
    with pytest.raises(AnalysisError):
        asyncio.run(voice.speak("The knight attacks the queen."))
    with pytest.raises(AnalysisError):
        asyncio.run(CoachVoice("").speak("The knight attacks the queen."))
