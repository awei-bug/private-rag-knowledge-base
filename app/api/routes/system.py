from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.core.config import get_settings
from app.db.capabilities import has_pgvector
from app.db.health import check_database_connection
from app.dependencies import get_settings_service
from app.models.auth import UserProfile
from app.models.settings import ConfigResponseModel, UserPreferences
from app.services.settings_service import SettingsService

router = APIRouter(tags=["system"])


@router.get("/health")
def healthcheck() -> dict[str, str]:
    database_ok, _ = check_database_connection()
    return {"status": "ok" if database_ok else "degraded"}


@router.get("/health/db")
def healthcheck_database() -> dict[str, str]:
    healthy, detail = check_database_connection()
    return {"status": "ok" if healthy else "error", "detail": detail}


@router.get("/config", response_model=ConfigResponseModel)
def get_config(
    _: UserProfile = Depends(get_current_user),
    settings_service: SettingsService = Depends(get_settings_service),
) -> ConfigResponseModel:
    settings = get_settings()
    database_backend = settings.database_url.split("://", maxsplit=1)[0]
    return ConfigResponseModel(
        app_name=settings.app_name,
        app_version=settings.app_version,
        environment=settings.environment,
        top_k=settings.retrieval_top_k,
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        database_backend=database_backend,
        pgvector_enabled=str(has_pgvector()).lower(),
        runtime_mode="local" if settings.local_mode_enabled else "authenticated",
        embedding_provider=settings.embedding_provider,
        llm_provider=settings.llm_provider,
        preferences=settings_service.get_preferences(),
    )


@router.put("/config/preferences", response_model=ConfigResponseModel)
def update_preferences(
    payload: UserPreferences,
    _: UserProfile = Depends(get_current_user),
    settings_service: SettingsService = Depends(get_settings_service),
) -> ConfigResponseModel:
    settings = get_settings()
    database_backend = settings.database_url.split("://", maxsplit=1)[0]
    preferences = settings_service.update_preferences(payload)
    return ConfigResponseModel(
        app_name=settings.app_name,
        app_version=settings.app_version,
        environment=settings.environment,
        top_k=settings.retrieval_top_k,
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        database_backend=database_backend,
        pgvector_enabled=str(has_pgvector()).lower(),
        runtime_mode="local" if settings.local_mode_enabled else "authenticated",
        embedding_provider=settings.embedding_provider,
        llm_provider=settings.llm_provider,
        preferences=preferences,
    )
