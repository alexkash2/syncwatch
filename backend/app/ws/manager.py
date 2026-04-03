import time
import uuid
from dataclasses import dataclass, field

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
        # room_id -> {user_id -> WebSocket}
        self.rooms: dict[str, dict[str, WebSocket]] = {}
        # connection_id -> (room_id, user_id)
        self.connections: dict[str, tuple[str, str]] = {}
        # room_id -> RoomState
        self.room_states: dict[str, RoomState] = {}
        # room_id -> seq counter
        self.seq_counters: dict[str, int] = {}

    def _next_seq(self, room_id: str) -> int:
        self.seq_counters.setdefault(room_id, 0)
        self.seq_counters[room_id] += 1
        return self.seq_counters[room_id]

    def _server_time_ms(self) -> int:
        return int(time.time() * 1000)

    async def connect(
        self, room_id: str, user_id: str, ws: WebSocket
    ) -> tuple[str, WebSocket | None]:
        """Connect a user. Returns (connection_id, old_ws_or_None)."""
        connection_id = uuid.uuid4().hex
        self.rooms.setdefault(room_id, {})
        self.room_states.setdefault(room_id, RoomState())

        # Tab dedup: close old connection for same user in same room
        old_ws = self.rooms[room_id].get(user_id)

        self.rooms[room_id][user_id] = ws
        self.connections[connection_id] = (room_id, user_id)
        return connection_id, old_ws

    async def disconnect(self, room_id: str, user_id: str):
        if room_id in self.rooms:
            self.rooms[room_id].pop(user_id, None)
            if not self.rooms[room_id]:
                del self.rooms[room_id]
                self.room_states.pop(room_id, None)
                self.seq_counters.pop(room_id, None)

    async def broadcast(
        self, room_id: str, message: dict, exclude_user: str | None = None
    ):
        message["seq"] = self._next_seq(room_id)
        message["server_time"] = self._server_time_ms()
        connections = self.rooms.get(room_id, {})
        for uid, ws in list(connections.items()):
            if uid == exclude_user:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                pass  # Dead connection, will be cleaned up on next receive

    async def send_to_user(self, room_id: str, user_id: str, message: dict):
        message.setdefault("seq", self._next_seq(room_id))
        message.setdefault("server_time", self._server_time_ms())
        ws = self.rooms.get(room_id, {}).get(user_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                pass

    def get_room_users(self, room_id: str) -> list[str]:
        return list(self.rooms.get(room_id, {}).keys())


manager = ConnectionManager()
