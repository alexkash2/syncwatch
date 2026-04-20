# ── Build stage: install deps into the standard prefix ──
# We install into the default /usr/local layout (no `--prefix`) so that Python
# picks up site-packages automatically in the runtime stage — we just copy
# /usr/local over and nothing else has to be wired up.
FROM python:3.13-slim AS build

WORKDIR /build
ENV PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# ── Runtime stage: slim image, non-root user, no pip/build toolchain ──
FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# curl is only needed for the Docker healthcheck below.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# Copy the installed packages and their console scripts (alembic, uvicorn, ...)
# into the runtime's /usr/local so Python finds them on sys.path by default.
COPY --from=build /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=build /usr/local/bin /usr/local/bin

# Create an unprivileged user. Running as root is an unnecessary blast radius
# if the app is ever compromised (file writes, privilege escalation).
RUN groupadd --system --gid 1000 syncwatch \
 && useradd  --system --uid 1000 --gid syncwatch --create-home syncwatch

WORKDIR /app
COPY --chown=syncwatch:syncwatch . .

USER syncwatch

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
