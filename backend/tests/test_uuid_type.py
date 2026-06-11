"""Regression: a UUID whose 32-char hex parses as scientific notation
(only digits plus a single 'e', e.g. ``…1e05``) must round-trip intact on
the SQLite test backend.

The models used to declare ``sqlalchemy.dialects.postgresql.UUID``, which
compiles to a column of type name "UUID" on SQLite. That name gets NUMERIC
affinity, so float-looking hex strings silently came back as Python floats
and ``uuid.UUID(<float>)`` raised — a once-in-a-million flake whenever
``uuid4()`` produced such a value. The portable ``sqlalchemy.Uuid``
(native on Postgres, CHAR(32)/TEXT affinity elsewhere) is immune.
"""

import asyncio
import pathlib
import tempfile
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.models.base import Base
from app.models.user import User

FLOAT_LOOKING_UUID = uuid.UUID("00000000000000000000000000001e05")


def test_float_looking_uuid_roundtrips_on_sqlite():
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    db_path = pathlib.Path(tmp.name).as_posix()
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}", poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def scenario():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with session_factory() as session:
            session.add(
                User(
                    id=FLOAT_LOOKING_UUID,
                    username="edgecase",
                    email="edgecase@example.com",
                    password_hash="not-a-real-hash",
                )
            )
            await session.commit()
        async with session_factory() as session:
            row = (
                await session.execute(select(User).where(User.username == "edgecase"))
            ).scalar_one()
            assert isinstance(row.id, uuid.UUID)
            assert row.id == FLOAT_LOOKING_UUID
        await engine.dispose()

    asyncio.run(scenario())
    pathlib.Path(tmp.name).unlink(missing_ok=True)
