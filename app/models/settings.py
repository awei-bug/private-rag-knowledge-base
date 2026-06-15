from typing import Literal

from pydantic import BaseModel, Field


class UserPreferences(BaseModel):
    default_folder_path: str = "F:/Python_code/RAG 本地知识库问系统/examples/knowledge-base"
    default_retrieval_mode: Literal["precise", "semantic", "hybrid"] = "hybrid"
    top_k: int = Field(default=5, ge=1, le=20)
    preferred_runtime_mode: Literal["local", "api"] = "local"
    query_rewrite_enabled: bool = True
    lexical_weight: float = Field(default=0.45, ge=0.0, le=1.0)
    semantic_weight: float = Field(default=0.55, ge=0.0, le=1.0)


class ConfigResponseModel(BaseModel):
    app_name: str
    app_version: str
    environment: str
    top_k: int
    chunk_size: int
    chunk_overlap: int
    database_backend: str
    pgvector_enabled: str
    runtime_mode: str
    embedding_provider: str
    llm_provider: str
    preferences: UserPreferences
