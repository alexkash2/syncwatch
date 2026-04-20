import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, ConflictError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    mark_refresh_used,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import TokenResponse


async def register_user(
    db: AsyncSession, username: str, email: str, password: str
) -> User:
    # Normalize to prevent "Admin" vs "admin" duplicate accounts (impersonation).
    normalized_username = username.strip()
    normalized_email = email.strip().lower()

    # Case-insensitive uniqueness check. The generic error message avoids
    # leaking which field collided (mitigates account enumeration).
    existing = await db.execute(
        select(User).where(
            (func.lower(User.email) == normalized_email)
            | (func.lower(User.username) == normalized_username.lower())
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise ConflictError("Registration failed. Please try different credentials.")

    user = User(
        username=normalized_username,
        email=normalized_email,
        password_hash=hash_password(password),
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Registration failed. Please try different credentials.")
    await db.refresh(user)
    return user


# A pre-computed bcrypt hash used to neutralize the timing difference between
# "user not found" (no bcrypt work) and "wrong password" (full bcrypt compare).
# The plaintext for this hash is not used anywhere; only the cost matters.
_DUMMY_BCRYPT_HASH = (
    "$2b$12$CwTycUXWue0Thq9StjUM0u" "J8pY6b8F2KIL7v8qKMSz/fWeS/uRYEq"
)


async def login_user(db: AsyncSession, email: str, password: str) -> TokenResponse:
    # Normalize email for lookup — registration also lowercases on storage.
    normalized = email.strip().lower()
    result = await db.execute(select(User).where(User.email == normalized))
    user = result.scalar_one_or_none()
    if user is None:
        # Run bcrypt against a dummy hash so "user not found" takes roughly
        # the same time as "wrong password" — stops timing-based enumeration.
        verify_password(password, _DUMMY_BCRYPT_HASH)
        raise BadRequestError("Invalid email or password")
    # Reject disabled accounts *silently* — returning a distinct "Account is
    # disabled" message would confirm the account exists, defeating the
    # no-enumeration stance of the unknown-user branch above.
    if not user.is_active or not verify_password(password, user.password_hash):
        raise BadRequestError("Invalid email or password")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


async def refresh_tokens(db: AsyncSession, refresh_token: str) -> TokenResponse:
    payload = decode_token(refresh_token, expected_type="refresh")
    if payload is None:
        raise BadRequestError("Invalid or expired refresh token")

    jti = payload.get("jti")
    exp = payload.get("exp")
    if not jti or not exp:
        raise BadRequestError("Invalid or expired refresh token")

    user_id_str = payload.get("sub")
    try:
        user_id = uuid.UUID(user_id_str)
    except (ValueError, TypeError):
        raise BadRequestError("Invalid token payload")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise BadRequestError("Invalid or expired refresh token")

    # Only burn the jti after we've verified signature, shape, and that the
    # user is still valid. Burning it earlier would let a transient DB error
    # throw away a still-good token and force re-login for no reason.
    if not mark_refresh_used(jti, int(exp)):
        raise BadRequestError("Invalid or expired refresh token")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )
