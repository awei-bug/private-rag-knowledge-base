from sqlalchemy.orm import sessionmaker

from app.db.session import get_session_factory
from app.generation.providers import LLMProvider, create_llm_provider
from app.generation.service import AnswerGenerationService
from app.ingestion.service import DocumentIngestionService
from app.ingestion.store import SqlAuditStore, SqlDocumentStore
from app.core.config import get_settings
from app.models.auth import AuthenticatedUser
from app.retrieval.embeddings import EmbeddingProvider, create_embedder
from app.retrieval.fulltext import FullTextSearch, create_full_text_search
from app.retrieval.pipeline import RetrievalPipeline
from app.retrieval.service import QueryService
from app.services.analytics_service import AnalyticsService
from app.services.maintenance_service import MaintenanceService
from app.services.settings_service import SettingsService


def get_embedder() -> EmbeddingProvider:
    settings = get_settings()
    return create_embedder(
        provider=settings.embedding_provider,
        dimensions=settings.embedding_dimensions,
        model=settings.embedding_model,
        api_key=settings.embedding_api_key,
        base_url=settings.embedding_base_url,
        timeout=settings.embedding_timeout,
    )


def get_llm_provider() -> LLMProvider:
    settings = get_settings()
    return create_llm_provider(
        provider=settings.llm_provider,
        model=settings.llm_model,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        timeout=settings.llm_timeout,
        temperature=settings.llm_temperature,
    )


def get_full_text_search() -> FullTextSearch:
    return create_full_text_search()


def get_document_service() -> DocumentIngestionService:
    session_factory = get_session_factory()
    embedder = get_embedder()
    return DocumentIngestionService(
        store=SqlDocumentStore(session_factory, embedder),
        full_text=get_full_text_search(),
    )


def get_settings_service() -> SettingsService:
    session_factory = get_session_factory()
    return SettingsService(session_factory)


def get_analytics_service() -> AnalyticsService:
    session_factory = get_session_factory()
    embedder = get_embedder()
    return AnalyticsService(
        document_store=SqlDocumentStore(session_factory, embedder),
        audit_store=SqlAuditStore(session_factory),
    )


def get_maintenance_service() -> MaintenanceService:
    settings = get_settings()
    session_factory = get_session_factory()
    embedder = get_embedder()
    return MaintenanceService(
        session_factory=session_factory,
        document_store=SqlDocumentStore(session_factory, embedder),
        audit_store=SqlAuditStore(session_factory),
        full_text=get_full_text_search(),
        backup_root=settings.backup_local_root,
    )


def get_query_service() -> QueryService:
    session_factory: sessionmaker = get_session_factory()
    embedder = get_embedder()
    document_store = SqlDocumentStore(session_factory, embedder)
    preferences = SettingsService(session_factory).get_preferences()
    pipeline = RetrievalPipeline(
        store=document_store,
        embedder=embedder,
        full_text=get_full_text_search(),
    )
    pipeline.apply_preferences(preferences)
    generator = AnswerGenerationService(provider=get_llm_provider())
    audit_store = SqlAuditStore(session_factory)
    return QueryService(pipeline=pipeline, generator=generator, audit_store=audit_store)


def authenticate_user(username: str, password: str) -> AuthenticatedUser | None:
    settings = get_settings()
    for user in settings.get_demo_users():
        if user.username == username and user.password == password:
            return user
    return None
