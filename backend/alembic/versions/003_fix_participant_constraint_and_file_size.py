"""fix participant unique constraint to partial index, file_size to bigint

Revision ID: 003
Revises: 002
Create Date: 2026-04-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the plain unique constraint, replace with partial unique index
    op.drop_constraint("uq_active_participant", "room_participants", type_="unique")
    op.execute(
        "CREATE UNIQUE INDEX ix_active_participant "
        "ON room_participants (room_id, user_id) "
        "WHERE left_at IS NULL"
    )

    # Fix file_size column type: Integer -> BigInteger
    op.alter_column(
        "rooms", "file_size",
        type_=sa.BigInteger(),
        existing_type=sa.Integer(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "rooms", "file_size",
        type_=sa.Integer(),
        existing_type=sa.BigInteger(),
        existing_nullable=True,
    )
    op.drop_index("ix_active_participant", "room_participants")
    op.create_unique_constraint(
        "uq_active_participant", "room_participants", ["room_id", "user_id"]
    )
