import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class RoomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class JoinRoomRequest(BaseModel):
    room_code: str = Field(min_length=1, max_length=8)


class ParticipantResponse(BaseModel):
    user_id: uuid.UUID
    username: str
    is_ready: bool
    joined_at: datetime

    model_config = {"from_attributes": True}


class RoomResponse(BaseModel):
    id: uuid.UUID
    name: str
    room_code: str
    host_id: uuid.UUID
    is_active: bool
    max_participants: int
    file_version: int
    created_at: datetime

    model_config = {"from_attributes": True}


class RoomDetailResponse(RoomResponse):
    participants: list[ParticipantResponse] = []
    host_username: str = ""


class RoomListResponse(BaseModel):
    rooms: list[RoomResponse]
    total: int


class FileInfoRequest(BaseModel):
    file_hash: str
    file_size: int
    file_duration_ms: int
    file_name: str = Field(max_length=500)
