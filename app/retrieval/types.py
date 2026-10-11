from pydantic import BaseModel, Field


class StoredChunk(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    document_acl: list[str] = Field(default_factory=list)
    chunk_acl: list[str] = Field(default_factory=list)
    content: str
    metadata: dict[str, str] = Field(default_factory=dict)
    embedding: list[float] = Field(default_factory=list)
    semantic_score: float | None = None


class RetrievedChunk(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    content: str
    score: float
    lexical_score: float = 0.0
    semantic_score: float = 0.0
    acl: list[str] = Field(default_factory=list)
    metadata: dict[str, str] = Field(default_factory=dict)


class RetrievalResult(BaseModel):
    rewritten_query: str
    chunks: list[RetrievedChunk] = Field(default_factory=list)
