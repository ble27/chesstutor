import socket

from redis import Redis
from redis.exceptions import RedisError

from services.adapters.analysis_queue import RQDispatch
from services.adapters.engine_binary import selected_artifact
from services.api.app.settings import Settings


def main() -> None:
    settings = Settings()
    try:
        with Redis.from_url(
            settings.redis_url.get_secret_value(), socket_connect_timeout=1, socket_timeout=1
        ) as redis:
            ready = RQDispatch(redis, selected_artifact(settings.engine_platform).binary_sha256)
            if not ready.ready(socket.gethostname()):
                raise SystemExit(1)
    except OSError, RedisError:
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
