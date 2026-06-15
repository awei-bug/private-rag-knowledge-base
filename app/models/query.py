from typing import Literal

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    question: str = Field(min_length=1)
    filters: dict[str, str] = Field(default_factory=dict)
    retrieval_mode: Literal["precise", "semantic", "hybrid"] = "hybrid"
    query_rewrite_enabled: bool | None = None
    top_k: int | None = Field(default=None, ge=1, le=20)


class Citation(BaseModel):
    document_id: str
    document_title: str
    chunk_id: str
    score: float
    content_preview: str = ""


class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation]
    confidence: float
    rewritten_query: str


class RetrievalDebugChunk(BaseModel):
    document_id: str
    document_title: str
    chunk_id: str
    score: float
    lexical_score: float
    semantic_score: float
    metadata: dict[str, str] = Field(default_factory=dict)
    content_preview: str


class RetrievalDebugResponse(BaseModel):
    rewritten_query: str
    chunks: list[RetrievalDebugChunk]


class RetrievalEvaluationCase(BaseModel):
    question: str
    expected_document_id: str
    retrieval_mode: Literal["precise", "semantic", "hybrid"] = "hybrid"
    filters: dict[str, str] = Field(default_factory=dict)


class RetrievalEvaluationRequest(BaseModel):
    cases: list[RetrievalEvaluationCase] = Field(default_factory=list)


class RetrievalEvaluationResult(BaseModel):
    question: str
    expected_document_id: str
    matched: bool
    top_document_id: str | None = None
    rewritten_query: str


class RetrievalEvaluationResponse(BaseModel):
    cases: list[RetrievalEvaluationResult] = Field(default_factory=list)
