import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    # Alphanumeric + underscore/hyphen/dot. Blocks whitespace, unicode lookalikes,
    # and control characters that enable impersonation in chat/participant list.
    username: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_.\-]+$")
    email: EmailStr
    # OWASP ASVS recommends 8+; bcrypt truncates at 72 bytes so cap below that.
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class WsTicketRequest(BaseModel):
    room_id: uuid.UUID


class WsTicketResponse(BaseModel):
    ticket: str
