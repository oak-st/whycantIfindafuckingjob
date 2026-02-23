"""Simple Fernet encryption for credential storage."""
import os
from cryptography.fernet import Fernet
from config import ENCRYPTION_KEY


def _get_fernet() -> Fernet:
    key = ENCRYPTION_KEY
    if not key:
        # Generate a key on first run and write it to .env
        key = Fernet.generate_key().decode()
        env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
        with open(env_path, "a") as f:
            f.write(f"\nENCRYPTION_KEY={key}\n")
        os.environ["ENCRYPTION_KEY"] = key
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt(value: str) -> str:
    if not value:
        return ""
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    if not value:
        return ""
    try:
        return _get_fernet().decrypt(value.encode()).decode()
    except Exception:
        return ""
