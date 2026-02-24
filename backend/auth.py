"""JWT-based single-user authentication."""
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status
from passlib.context import CryptContext

ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET", "")
    if not secret:
        secret = secrets.token_hex(32)
        env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
        with open(env_path, "a") as f:
            f.write(f"\nJWT_SECRET={secret}\n")
        os.environ["JWT_SECRET"] = secret
    return secret


def admin_username() -> str:
    return os.getenv("ADMIN_USERNAME", "admin")


def admin_password() -> str:
    return os.getenv("ADMIN_PASSWORD", "")


def verify_password(plain: str, stored: str) -> bool:
    """Verify against a bcrypt hash or plain-text env var."""
    try:
        return pwd_context.verify(plain, stored)
    except Exception:
        return plain == stored  # plain-text fallback for env var


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def create_token(username: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": username, "exp": exp}, _jwt_secret(), algorithm=ALGORITHM)


def decode_token(token: str) -> str:
    """Decode and validate a JWT. Returns the username or raises 401."""
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[ALGORITHM])
        return payload["sub"]
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
