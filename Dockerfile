FROM ghcr.io/astral-sh/uv:0.11.2@sha256:c4f5de312ee66d46810635ffc5df34a1973ba753e7241ce3a08ef979ddd7bea5 AS uv
FROM python:3.14.7-slim@sha256:51dafde81dbdb6ebde285137a295cf18a47ca95234fe388a343719cb97305b3d AS application
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_PYTHON_DOWNLOADS=never PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml uv.lock .python-version ./
COPY LICENSE THIRD_PARTY_NOTICES.md ./
COPY engines ./engines
COPY services ./services
COPY scripts ./scripts
COPY alembic.ini ./
COPY migrations ./migrations
RUN uv sync --frozen --no-dev && useradd --create-home chess
USER chess
EXPOSE 8000
CMD [".venv/bin/uvicorn", "services.api.app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]

FROM application AS engine-worker
USER root
RUN .venv/bin/python -m scripts.install_engine --platform linux-x86_64 && chown -R chess:chess /app/bin && rm -rf /app/.cache
USER chess
CMD [".venv/bin/python", "-m", "services.worker.main"]
