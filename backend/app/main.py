import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import settings
from app.core.security import cleanup_expired_ws_tickets
from app.ws.handler import router as ws_router


async def _ticket_cleanup_loop():
    while True:
        await asyncio.sleep(60)
        cleanup_expired_ws_tickets()


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_ticket_cleanup_loop())
    yield
    task.cancel()


app = FastAPI(title="SyncWatch", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(ws_router)
