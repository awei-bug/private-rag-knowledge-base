from __future__ import annotations

from functools import lru_cache

from sqlalchemy import text

from app.db.session import get_engine


@lru_cache
def has_pgvector() -> bool:
    engine = get_engine()
    if not str(engine.url).startswith("postgresql"):
        return False

    try:
        with engine.connect() as connection:
            result = connection.execute(
                text("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector')")
            ).scalar()
        return bool(result)
    except Exception:
        return False
