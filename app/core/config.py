from functools import lru_cache
from typing import Any

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.models.auth import AuthenticatedUser


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="RAG_", extra="ignore")

    app_name: str = "Local RAG Knowledge Base"
    app_version: str = "0.1.0"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    retrieval_top_k: int = 5
    chunk_size: int = 500
    chunk_overlap: int = 50
    min_score_threshold: float = Field(default=0.15, ge=0.0, le=1.0)
    embedding_provider: str = "hashing"
    embedding_dimensions: int = Field(default=128, ge=16, le=4096)
    embedding_model: str = "text-embedding-3-small"
    embedding_api_key: str | None = None
    embedding_base_url: str | None = None
    embedding_timeout: float = Field(default=30.0, ge=1.0, le=120.0)
    llm_provider: str = "template"
    llm_model: str = "gpt-4o-mini"
    llm_api_key: str | None = None
    llm_base_url: str | None = None
    llm_timeout: float = Field(default=60.0, ge=1.0, le=180.0)
    llm_temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    lexical_weight: float = Field(default=0.45, ge=0.0, le=1.0)
    semantic_weight: float = Field(default=0.55, ge=0.0, le=1.0)
    vector_candidate_limit: int = Field(default=100, ge=1, le=1000)
    opensearch_enabled: bool = False
    opensearch_url: str = "http://127.0.0.1:9200"
    opensearch_index: str = "rag_chunks"
    opensearch_timeout: float = Field(default=5.0, ge=1.0, le=60.0)
    opensearch_candidate_limit: int = Field(default=100, ge=1, le=1000)
    opensearch_weight: float = Field(default=0.2, ge=0.0, le=1.0)
    database_url: str = "sqlite:///./rag.db"
    database_echo: bool = False
    database_pool_size: int = Field(default=10, ge=1, le=100)
    database_max_overflow: int = Field(default=20, ge=0, le=100)
    database_connect_timeout: int = Field(default=5, ge=1, le=60)
    cors_allow_origins: list[str] = Field(
        default_factory=lambda: [
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:5174",
            "http://localhost:5174",
        ]
    )
    cors_allow_credentials: bool = True
    storage_local_root: str = "./data/uploads"
    local_mode_enabled: bool = True
    local_mode_user: dict[str, Any] = Field(
        default_factory=lambda: {
            "username": "local-user",
            "password": "",
            "role": "admin",
            "allowed_acl": [],
            "display_name": "本地用户",
        }
    )
    auth_secret_key: str = "enterprise-rag-dev-secret"
    auth_token_ttl_minutes: int = Field(default=480, ge=5, le=10080)
    auth_demo_users: list[dict[str, Any]] = Field(
        default_factory=lambda: [
            {
                "username": "admin",
                "password": "rag-console",
                "role": "admin",
                "allowed_acl": ["engineering", "finance", "security"],
                "display_name": "系统管理员",
            },
            {
                "username": "analyst",
                "password": "rag-analyst",
                "role": "editor",
                "allowed_acl": ["engineering"],
                "display_name": "知识库运营",
            },
            {
                "username": "auditor",
                "password": "rag-audit",
                "role": "auditor",
                "allowed_acl": ["engineering", "finance"],
                "display_name": "审计专员",
            },
        ]
    )

    def get_demo_users(self) -> list[AuthenticatedUser]:
        return [AuthenticatedUser(**item) for item in self.auth_demo_users]

    def get_local_user(self) -> AuthenticatedUser:
        return AuthenticatedUser(**self.local_mode_user)


@lru_cache
def get_settings() -> Settings:
    return Settings()
