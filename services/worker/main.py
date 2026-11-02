from redis import Redis
from rq import Worker
from rq.serializers import JSONSerializer

from services.api.app.settings import Settings


def main() -> None:
    settings = Settings()
    with Redis.from_url(settings.redis_url.get_secret_value()) as connection:
        worker = Worker(["analysis"], connection=connection, serializer=JSONSerializer)
        worker.work(logging_level="WARNING")


if __name__ == "__main__":
    main()
