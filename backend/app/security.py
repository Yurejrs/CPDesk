import os
import secrets
from pathlib import Path

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from .database import get_db
from .models import User

password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)
def _session_secret() -> str:
    configured = os.getenv("CPDESK_SECRET_KEY")
    if configured:
        return configured
    default_secret_path = Path(__file__).resolve().parents[1] / "data" / "session.key"
    secret_path = Path(os.getenv("CPDESK_SECRET_FILE", str(default_secret_path)))
    secret_path.parent.mkdir(parents=True, exist_ok=True)
    if not secret_path.exists():
        secret_path.write_text(secrets.token_urlsafe(48), encoding="utf-8")
        try:
            secret_path.chmod(0o600)
        except OSError:
            pass
    return secret_path.read_text(encoding="utf-8").strip()


SESSION_SECRET = _session_secret()
SESSION_TTL = 60 * 60 * 12


def hash_password(value: str) -> str:
    return password_hash.hash(value)


def verify_password(value: str, hashed: str) -> bool:
    return password_hash.verify(value, hashed)


def create_token(user: User) -> str:
    from itsdangerous import URLSafeTimedSerializer
    return URLSafeTimedSerializer(SESSION_SECRET, salt="cpdesk-session").dumps({"uid": user.id})


def current_user(request: Request, token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
    token = token or request.cookies.get("cpdesk_session")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária")
    try:
        data = URLSafeTimedSerializer(SESSION_SECRET, salt="cpdesk-session").loads(token, max_age=SESSION_TTL)
    except (BadSignature, SignatureExpired):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida ou expirada")
    user = db.get(User, data.get("uid"))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário inativo")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Ação exclusiva do administrador")
    return user
