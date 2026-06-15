from __future__ import annotations

from sqlalchemy import text

from app.db.session import get_engine


def check_database_connection() -> tuple[bool, str]:
    engine = get_engine()
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, "ok"
    except Exception as exc:
        return False, exc.__class__.__name__
