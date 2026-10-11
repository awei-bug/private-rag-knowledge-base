from datetime import datetime

from pydantic import BaseModel, Field

from app.models.query import Citation


class QueryLogRecord(BaseModel):
    log_id: str | None = None
    user_id: str
    role: str | None = None
    question: str
    rewritten_query: str
    answer: str
    confidence: float
    filters: dict[str, str] = Field(default_factory=dict)
    citations: list[Citation] = Field(default_factory=list)
    latency_ms: int
    created_at: datetime | None = None
