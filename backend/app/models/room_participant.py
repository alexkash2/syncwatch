import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, func, text
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class RoomParticipant(Base):
    __tablename__ = "room_participants"
    __table_args__ = (
        # Partial unique index: one ACTIVE membership per (room, user); leaving
        # and rejoining inserts a fresh row. sqlite_where keeps the SQLite test
        # backend on the same semantics (without it the index degrades to a
        # full unique index there and every rejoin insert hits IntegrityError).
        Index(
            "ix_active_participant",
            "room_id", "user_id",
            unique=True,
            postgresql_where="left_at IS NULL",
            sqlite_where=text("left_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    is_ready: Mapped[bool] = mapped_column(Boolean, default=False)
    joined_at: Mapped[datetime] = mapped_column(server_default=func.now())
    left_at: Mapped[datetime | None] = mapped_column(nullable=True)

    room = relationship("Room", back_populates="participants")
    user = relationship("User")
