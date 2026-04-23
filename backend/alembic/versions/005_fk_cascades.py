"""add ON DELETE cascades on user/room FKs

Revision ID: 005
Revises: 004
Create Date: 2026-04-20

Without cascades, deleting a User is blocked by Room.host_id / Participant /
ChatMessage references, and deleting a Room leaves orphan participants and
chat messages. Cascade rules make cleanup predictable.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _recreate_fk(
    table: str, column: str, ref_table: str, ref_col: str, ondelete: str
) -> None:
    """Drop whatever FK references `table.column → ref_table.ref_col` and
    recreate it with the requested ON DELETE. Alembic's auto-names differ
    across Postgres versions, so we resolve the actual constraint name via
    SQLAlchemy's inspector instead of hard-coding it or running DDL with
    bind params (asyncpg refuses `:name::regclass` — the colon-cast collides
    with parameter syntax).
    """
    bind = op.get_bind()
    insp = sa.inspect(bind)
    for fk in insp.get_foreign_keys(table):
        if column in fk.get("constrained_columns", []) and fk.get("name"):
            op.drop_constraint(fk["name"], table, type_="foreignkey")
    op.create_foreign_key(
        f"fk_{table}_{column}_{ref_table}",
        table,
        ref_table,
        [column],
        [ref_col],
        ondelete=ondelete,
    )


def upgrade() -> None:
    # Deleting a user cascades to rooms they host, participations, and chat lines.
    _recreate_fk("rooms", "host_id", "users", "id", "CASCADE")
    _recreate_fk("room_participants", "user_id", "users", "id", "CASCADE")
    _recreate_fk("chat_messages", "user_id", "users", "id", "CASCADE")

    # Deleting a room cascades to its participants and chat messages.
    _recreate_fk("room_participants", "room_id", "rooms", "id", "CASCADE")
    _recreate_fk("chat_messages", "room_id", "rooms", "id", "CASCADE")


def downgrade() -> None:
    _recreate_fk("rooms", "host_id", "users", "id", "NO ACTION")
    _recreate_fk("room_participants", "user_id", "users", "id", "NO ACTION")
    _recreate_fk("chat_messages", "user_id", "users", "id", "NO ACTION")
    _recreate_fk("room_participants", "room_id", "rooms", "id", "NO ACTION")
    _recreate_fk("chat_messages", "room_id", "rooms", "id", "NO ACTION")
