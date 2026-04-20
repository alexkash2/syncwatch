import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.router import api_router
from app.config import settings
from app.core.security import cleanup_expired_ws_tickets, cleanup_used_refresh_jtis
from app import database as db_module
from app.ws.handler import router as ws_router
from app.ws.manager import manager

logger = logging.getLogger("syncwatch")


async def _ticket_cleanup_loop():
    while True:
        await asyncio.sleep(60)
        cleanup_expired_ws_tickets()
        cleanup_used_refresh_jtis()


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_ticket_cleanup_loop())
    try:
        yield
    finally:
        task.cancel()
        # Graceful shutdown: notify every active room so clients navigate out
        # cleanly instead of hitting the WS-level disconnect grace-period path.
        active_rooms = list(manager.rooms.keys())
        for room_id in active_rooms:
            try:
                await manager.close_room(room_id, "server_shutdown")
            except Exception:
                logger.exception("Error closing room %s on shutdown", room_id)
        await db_module.engine.dispose()


app = FastAPI(title="SyncWatch", version="0.1.0", lifespan=lifespan)


@app.get("/health", tags=["health"])
async def health():
    """Liveness + readiness: verify DB is reachable."""
    try:
        async with db_module.engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}
    except Exception as exc:
        # 503 so orchestrators can act on it; still return structured JSON.
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "error", "db": str(exc)[:200]},
        )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(ws_router)
