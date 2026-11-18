import hashlib
import hmac
import secrets
import time
from dataclasses import dataclass

from fastapi import Request, Response
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from services.api.app.settings import Settings
from services.core.analysis.values import AnalysisError

COOKIE = "chess_session"
SESSION_SECONDS = 30 * 24 * 3600


@dataclass(frozen=True)
class Session:
    owner: str
    cookie: str


class AnalysisSecurity:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.secret = settings.session_secret.get_secret_value().encode()

    def signature(self, value: str) -> str:
        return hmac.new(self.secret, value.encode(), hashlib.sha256).hexdigest()

    def session(self, request: Request) -> Session:
        cookie = request.cookies.get(COOKIE, "")
        pieces = cookie.split(".") if len(cookie) <= 160 else []
        if len(pieces) == 3:
            owner, expiry, signature = pieces
            if (
                len(owner) == 32
                and all(char in "0123456789abcdef" for char in owner)
                and expiry.isdecimal()
                and len(expiry) <= 12
                and int(expiry) > time.time()
                and len(signature) == 64
                and all(char in "0123456789abcdef" for char in signature)
                and hmac.compare_digest(self.signature(owner + "." + expiry), signature)
            ):
                return Session(owner, cookie)
        owner = secrets.token_hex(16)
        value = f"{owner}.{int(time.time()) + SESSION_SECONDS}"
        return Session(owner, value + "." + self.signature(value))

    def origin(self, request: Request) -> None:
        if request.headers.get("origin") not in self.settings.allowed_origins:
            raise AnalysisError(
                "invalid_origin", "Analysis requests require a trusted application origin.", 403
            )

    def challenge(self, request: Request, session: Session) -> JSONResponse:
        # No work is allocated until the client can resend this signed cookie.
        # Losing this response is therefore safe to retry without orphan jobs.
        response = JSONResponse(
            status_code=409,
            content={
                "code": "session_required",
                "message": "Accept the session cookie before submitting analysis.",
                "retryable": True,
                "request_id": request.state.request_id,
            },
        )
        self.cookie(response, session)
        return response

    def ip_digest(self, request: Request) -> str:
        # Do not trust user-controlled forwarding headers; configure trusted proxies at deployment.
        address = request.client.host if request.client else "unknown"
        return self.signature("ip:" + address)

    def cookie(self, response: Response, session: Session) -> None:
        response.set_cookie(
            COOKIE,
            session.cookie,
            httponly=True,
            samesite="lax",
            secure=self.settings.environment == "production",
            max_age=SESSION_SECONDS,
            path="/api/v1",
        )


class AnalysisBodyLimit:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or scope["method"] != "POST"
            or not (
                scope["path"].startswith("/api/v1/analyses")
                or scope["path"].endswith("/browser-evidence")
                or scope["path"].endswith("/sandbox")
            )
        ):
            await self.app(scope, receive, send)
            return
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            maximum = (
                16384
                if scope["path"].endswith("/sandbox")
                else 65536
                if scope["path"].endswith("/browser-evidence")
                else 4096
            )
            if len(body) > maximum:
                response = JSONResponse(
                    status_code=413,
                    content={
                        "code": "request_too_large",
                        "message": "Analysis request exceeds its size limit.",
                        "retryable": False,
                        "request_id": scope.get("state", {}).get("request_id", "unknown"),
                    },
                )
                await response(scope, receive, send)
                return
            if not message.get("more_body", False):
                break
        sent = False

        async def replay() -> Message:
            nonlocal sent
            if sent:
                return await receive()
            sent = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}

        await self.app(scope, replay, send)
