#!/bin/bash
set -e

cd backend

# Apply database migrations (idempotent: no-op if already up to date).
# Migrations are authored explicitly with `shaapi db generate`, never
# auto-generated at boot.
alembic upgrade head

# The BTS library ships with the image: refresh it at every start (idempotent,
# a few hundred rows). A failure is logged, it must not keep the API down.
(cd .. && python -m backend.cli seed-library) || echo "[warn] seed-library failed, the API starts anyway"

# Live-reload in development (the source is bind-mounted by the dev compose).
# In production (ENVIRONMENT=prod) the baked-in code is served without reload.
RELOAD=""
if [ "${ENVIRONMENT:-dev}" = "dev" ]; then
  RELOAD="--reload"
fi

# Start the API server (exec => uvicorn becomes PID 1 and receives signals)
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 $RELOAD
