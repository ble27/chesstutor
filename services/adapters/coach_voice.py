"""Bounded ElevenLabs synthesis of application-authored move notes."""

import asyncio
import time
from collections import OrderedDict, deque

import httpx

from services.core.analysis.values import AnalysisError

VOICE_URL = "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb"
MAX_AUDIO_BYTES = 256 * 1024
MAX_TEXT_LENGTH = 600
MAX_REQUESTS_PER_HOUR = 40


class CoachVoice:
    def __init__(self, key: str, *, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self.key = key
        self.transport = transport
        self.cache: OrderedDict[str, bytes] = OrderedDict()
        self.pending: dict[str, asyncio.Task[bytes]] = {}
        self.starts: deque[float] = deque()

    async def speak(self, text: str) -> bytes:
        if not self.key:
            raise AnalysisError("voice_disabled", "Coach voice unavailable", 503)
        if not 0 < len(text) <= MAX_TEXT_LENGTH:
            raise AnalysisError("voice_note_unavailable", "Voice note unavailable", 409)
        if text in self.cache:
            self.cache.move_to_end(text)
            return self.cache[text]
        if text not in self.pending:
            now = time.monotonic()
            while self.starts and self.starts[0] <= now - 3600:
                self.starts.popleft()
            if len(self.pending) >= 2 or len(self.starts) >= MAX_REQUESTS_PER_HOUR:
                raise AnalysisError("voice_limit", "Coach voice temporarily busy", 429)
            self.starts.append(now)
            self.pending[text] = asyncio.create_task(self.generate(text))
            self.pending[text].add_done_callback(observe_voice_task)
        # A disconnected listener must not cancel generation for another listener.
        return await asyncio.shield(self.pending[text])

    async def generate(self, text: str) -> bytes:
        try:
            audio = await self.download(text)
            self.cache[text] = audio
            if len(self.cache) > 24:
                self.cache.popitem(last=False)
            return audio
        except (httpx.HTTPError, TimeoutError) as error:
            raise AnalysisError("voice_unavailable", "Coach voice unavailable", 502) from error
        finally:
            self.pending.pop(text, None)

    async def download(self, text: str) -> bytes:
        async with (
            asyncio.timeout(12),
            httpx.AsyncClient(transport=self.transport, timeout=8, trust_env=False) as client,
            client.stream(
                "POST",
                VOICE_URL,
                params={"output_format": "mp3_22050_32"},
                headers={
                    "xi-api-key": self.key,
                    "accept": "audio/mpeg",
                    "accept-encoding": "identity",
                },
                json={
                    "text": text,
                    "model_id": "eleven_multilingual_v2",
                    "voice_settings": {
                        "stability": 0.38,
                        "similarity_boost": 0.75,
                        "style": 0.22,
                        "speed": 0.96,
                    },
                },
            ) as response,
        ):
            response.raise_for_status()
            if (
                response.headers.get("content-type", "").split(";", 1)[0] != "audio/mpeg"
                or response.headers.get("content-encoding", "identity") != "identity"
            ):
                raise AnalysisError("voice_unavailable", "Coach voice unavailable", 502)
            audio = bytearray()
            async for chunk in response.aiter_raw(chunk_size=8192):
                audio.extend(chunk)
                if len(audio) > MAX_AUDIO_BYTES:
                    break
            if not audio or len(audio) > MAX_AUDIO_BYTES:
                raise AnalysisError("voice_unavailable", "Coach voice unavailable", 502)
            return bytes(audio)


def observe_voice_task(task: asyncio.Task[bytes]) -> None:
    if not task.cancelled():
        task.exception()
