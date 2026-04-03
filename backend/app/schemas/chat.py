import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    username: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessageResponse]
    next_cursor: str | None = None
