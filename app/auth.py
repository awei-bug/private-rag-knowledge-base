from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from fastapi import Depends, Header, HTTPException, status

from app.core.config import get_settings
from app.models.auth import AuthenticatedUser, LoginResponse, UserProfile


def _sign(payload: str, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


def create_access_token(user: AuthenticatedUser) -> LoginResponse:
    settings = get_settings()
    expires_in = settings.auth_token_ttl_minutes * 60
    payload = {
      "sub": user.username,
      "role": user.role,
      "allowed_acl": user.allowed_acl,
      "display_name": user.display_name,
      "exp": int(time.time()) + expires_in,
    }
    body = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    ).decode("utf-8").rstrip("=")
    signature = _sign(body, settings.auth_secret_key)
    token = f"{body}.{signature}"
    return LoginResponse(
        access_token=token,
        expires_in=expires_in,
        user=UserProfile(
            username=user.username,
            role=user.role,
            allowed_acl=user.allowed_acl,
            display_name=user.display_name,
        ),
    )


def refresh_access_token(user: UserProfile) -> LoginResponse:
    return create_access_token(
        AuthenticatedUser(
            username=user.username,
            role=user.role,
            allowed_acl=user.allowed_acl,
            display_name=user.display_name,
            password="refreshed-session",
        )
    )


def decode_access_token(token: str) -> UserProfile:
    settings = get_settings()
    try:
        body, signature = token.split(".", maxsplit=1)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.") from exc

    expected = _sign(body, settings.auth_secret_key)
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature.")

    padded = body + "=" * (-len(body) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8"))
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload.") from exc

    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired.")

    return UserProfile(
        username=str(payload["sub"]),
        role=str(payload["role"]),
        allowed_acl=[str(item) for item in payload.get("allowed_acl", [])],
        display_name=str(payload["display_name"]) if payload.get("display_name") else None,
    )


def get_current_user(authorization: str | None = Header(default=None)) -> UserProfile:
    settings = get_settings()
    if settings.local_mode_enabled and not authorization:
        user = settings.get_local_user()
        return UserProfile(
            username=user.username,
            role=user.role,
            allowed_acl=user.allowed_acl,
            display_name=user.display_name,
        )

    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization header.")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization header.")
    return decode_access_token(token)


def require_roles(*roles: str):
    allowed_roles = set(roles)

    def dependency(user: UserProfile = Depends(get_current_user)) -> UserProfile:
        if user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role.")
        return user

    return dependency
