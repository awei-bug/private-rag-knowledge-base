from __future__ import annotations

from functools import lru_cache

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.db.models import Base


@lru_cache
def get_engine():
    settings = get_settings()
    connect_args = {}
    engine_kwargs = {
        "echo": settings.database_echo,
        "future": True,
        "connect_args": connect_args,
    }
    if settings.database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    else:
        connect_args["connect_timeout"] = settings.database_connect_timeout
        engine_kwargs["pool_pre_ping"] = True
        engine_kwargs["pool_recycle"] = 1800
        engine_kwargs["pool_size"] = settings.database_pool_size
        engine_kwargs["max_overflow"] = settings.database_max_overflow

    return create_engine(settings.database_url, **engine_kwargs)


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, autocommit=False, expire_on_commit=False)


def init_db() -> None:
    engine = get_engine()
    _ensure_postgres_extensions(engine)
    Base.metadata.create_all(bind=engine)
    _apply_lightweight_migrations(engine)


def _apply_lightweight_migrations(engine) -> None:
    inspector = inspect(engine)
    if "document_chunks" not in inspector.get_table_names():
        return

    column_names = {column["name"] for column in inspector.get_columns("document_chunks")}
    with engine.begin() as connection:
        if "documents" in inspector.get_table_names():
            document_columns = {column["name"] for column in inspector.get_columns("documents")}
            if "file_path" not in document_columns:
                connection.execute(text("ALTER TABLE documents ADD COLUMN file_path VARCHAR(512)"))

        if "embedding_json" not in column_names:
            connection.execute(text("ALTER TABLE document_chunks ADD COLUMN embedding_json JSON"))
        if "embedding_vector" not in column_names:
            if _postgres_has_vector_type(connection):
                connection.execute(text("ALTER TABLE document_chunks ADD COLUMN embedding_vector vector"))
            else:
                connection.execute(text("ALTER TABLE document_chunks ADD COLUMN embedding_vector TEXT"))

        if "query_logs" in inspector.get_table_names():
            query_log_columns = {column["name"] for column in inspector.get_columns("query_logs")}
            if "role" not in query_log_columns:
                connection.execute(text("ALTER TABLE query_logs ADD COLUMN role VARCHAR(64)"))

        if "app_settings" not in inspector.get_table_names():
            return


def _ensure_postgres_extensions(engine) -> None:
    if not str(engine.url).startswith("postgresql"):
        return

    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    except SQLAlchemyError:
        # The extension is optional in the current implementation.
        return


def _postgres_has_vector_type(connection) -> bool:
    if not str(connection.engine.url).startswith("postgresql"):
        return False

    try:
        return bool(
            connection.execute(
                text("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector')")
            ).scalar()
        )
    except SQLAlchemyError:
        return False
