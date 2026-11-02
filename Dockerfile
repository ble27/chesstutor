FROM ghcr.io/astral-sh/uv:0.11.2@sha256:c4f5de312ee66d46810635ffc5df34a1973ba753e7241ce3a08ef979ddd7bea5 AS uv
FROM python:3.14.7-slim@sha256:51dafde81dbdb6ebde285137a295cf18a47ca95234fe388a343719cb97305b3d
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_PYTHON_DOWNLOADS=never PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml uv.lock .python-version ./
COPY LICENSE THIRD_PARTY_NOTICES.md ./
COPY engines ./engines
COPY services ./services
RUN uv sync --frozen --no-dev && useradd --create-home chess
USER chess
EXPOSE 8000
CMD [".venv/bin/uvicorn", "services.api.app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
