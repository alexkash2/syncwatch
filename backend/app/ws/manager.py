import asyncio
import time
import uuid
from dataclasses import dataclass

from fastapi import WebSocket


@dataclass
class RoomState:
    room_status: str = "waiting_file"
    is_playing: bool = False
    current_time_ms: int = 0
    last_update_epoch: float = 0.0
    playback_rate: float = 1.0
    file_version: int = 0


class ConnectionManager:
    def __init__(self):
        # room_id -> {user_id -> (WebSocket, connection_id)}
        self.rooms: dict[str, dict[str, tuple[WebSocket, str]]] = {}
        # room_id -> RoomState
        self.room_states: dict[str, RoomState] = {}
        # room_id -> seq counter
        self.seq_counters: dict[str, int] = {}
        # room_id -> heartbeat asyncio.Task
        self._heartbeat_tasks: dict[str, asyncio.Task] = {}

    def _next_seq(self, room_id: str) -> int:
        self.seq_counters.setdefault(room_id, 0)
        self.seq_counters[room_id] += 1
        return self.seq_counters[room_id]

    def _server_time_ms(self) -> int:
        return int(time.time() * 1000)

    async def disconnect(self, room_id: str, user_id: str, connection_id: str) -> bool:
        """Disconnect only if the connection_id matches current.
        Returns True if actually removed, False if it was already replaced."""
        if room_id not in self.rooms:
            return False
        entry = self.rooms[room_id].get(user_id)
        if entry is None:
            return False
        if entry[1] != connection_id:
            # This connection was already replaced by a newer one (tab dedup)
            return False

        del self.rooms[room_id][user_id]
        if not self.rooms[room_id]:
            del self.rooms[room_id]
            self.room_states.pop(room_id, None)
            self.seq_counters.pop(room_id, None)
            self._stop_heartbeat(room_id)
        return True

    async def broadcast(
        self, room_id: str, message: dict, exclude_user: str | None = None
    ):
        message["seq"] = self._next_seq(room_id)
        message["server_time"] = self._server_time_ms()
        connections = self.rooms.get(room_id, {})
        for uid, (ws, _cid) in list(connections.items()):
            if uid == exclude_user:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def send_to_user(self, room_id: str, user_id: str, message: dict):
        message.setdefault("seq", self._next_seq(room_id))
        message.setdefault("server_time", self._server_time_ms())
        entry = self.rooms.get(room_id, {}).get(user_id)
        if entry:
            try:
                await entry[0].send_json(message)
            except Exception:
                pass

    def get_room_users(self, room_id: str) -> list[str]:
        return list(self.rooms.get(room_id, {}).keys())

    def _start_heartbeat(self, room_id: str):
        """Start a per-room heartbeat if not already running."""
        if room_id in self._heartbeat_tasks:
            return

        async def _loop():
            try:
                while True:
                    await asyncio.sleep(3)
                    state = self.room_states.get(room_id)
                    if state and state.is_playing:
                        from app.ws.sync import get_current_time_ms
                        await self.broadcast(room_id, {
                            "type": "sync_check",
                            "current_time_ms": get_current_time_ms(state),
                            "is_playing": True,
                        })
            except asyncio.CancelledError:
                pass

        self._heartbeat_tasks[room_id] = asyncio.create_task(_loop())

    def _stop_heartbeat(self, room_id: str):
        task = self._heartbeat_tasks.pop(room_id, None)
        if task:
            task.cancel()

    async def connect(
        self, room_id: str, user_id: str, ws: WebSocket
    ) -> tuple[str, WebSocket | None]:
        """Connect a user. Returns (connection_id, old_ws_or_None)."""
        connection_id = uuid.uuid4().hex
        self.rooms.setdefault(room_id, {})
        self.room_states.setdefault(room_id, RoomState())

        old_entry = self.rooms[room_id].get(user_id)
        old_ws = old_entry[0] if old_entry else None

        self.rooms[room_id][user_id] = (ws, connection_id)

        # Start per-room heartbeat if first user
        self._start_heartbeat(room_id)

        return connection_id, old_ws

    async def close_room(self, room_id: str, reason: str):
        """Close all connections in a room and broadcast room_closed."""
        self._stop_heartbeat(room_id)
        await self.broadcast(room_id, {"type": "room_closed", "reason": reason})
        connections = self.rooms.pop(room_id, {})
        for uid, (ws, _cid) in connections.items():
            try:
                await ws.close(code=4000)
            except Exception:
                pass
        self.room_states.pop(room_id, None)
        self.seq_counters.pop(room_id, None)


manager = ConnectionManager()
