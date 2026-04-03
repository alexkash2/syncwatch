import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.chat_message import ChatMessage


async def save_message(
    db: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID, content: str
) -> ChatMessage:
    msg = ChatMessage(room_id=room_id, user_id=user_id, content=content[:2000])
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def get_history(
    db: AsyncSession,
    room_id: uuid.UUID,
    cursor: str | None = None,
    limit: int = 50,
) -> tuple[list[ChatMessage], str | None]:
    query = (
        select(ChatMessage)
        .options(selectinload(ChatMessage.user))
        .where(ChatMessage.room_id == room_id)
    )

    if cursor:
        # Cursor format: "created_at_iso:message_id"
        try:
            ts_str, msg_id_str = cursor.rsplit(":", 1)
            cursor_ts = datetime.fromisoformat(ts_str)
            cursor_id = uuid.UUID(msg_id_str)
            query = query.where(
                (ChatMessage.created_at < cursor_ts)
                | (
                    (ChatMessage.created_at == cursor_ts)
                    & (ChatMessage.id < cursor_id)
                )
            )
        except (ValueError, TypeError):
            pass  # Invalid cursor, ignore and return from start

    query = query.order_by(
        ChatMessage.created_at.desc(), ChatMessage.id.desc()
    ).limit(limit + 1)

    result = await db.execute(query)
    messages = list(result.scalars().all())

    next_cursor = None
    if len(messages) > limit:
        messages = messages[:limit]
        last = messages[-1]
        next_cursor = f"{last.created_at.isoformat()}:{last.id}"

    # Return in chronological order (oldest first)
    messages.reverse()
    return messages, next_cursor
