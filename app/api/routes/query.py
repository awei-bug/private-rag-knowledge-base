import csv
import io

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.auth import get_current_user, require_roles
from app.core.config import get_settings
from app.dependencies import get_query_service
from app.models.auth import UserProfile
from app.models.audit import QueryLogRecord
from app.models.query import (
    QueryRequest,
    QueryResponse,
    RetrievalDebugResponse,
    RetrievalEvaluationRequest,
    RetrievalEvaluationResponse,
)
from app.retrieval.service import QueryService

router = APIRouter(prefix="/query", tags=["query"])


def require_log_viewer(
    user: UserProfile = Depends(get_current_user),
    authorization: str | None = Header(default=None),
) -> UserProfile:
    if get_settings().local_mode_enabled and not authorization:
        return user
    if user.role not in {"admin", "auditor"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role.")
    return user


@router.post("", response_model=QueryResponse)
def query_knowledge_base(
    payload: QueryRequest,
    user: UserProfile = Depends(get_current_user),
    service: QueryService = Depends(get_query_service),
) -> QueryResponse:
    return service.answer(payload, user)


@router.get("/logs", response_model=list[QueryLogRecord])
def list_query_logs(
    limit: int = Query(default=50, ge=1, le=200),
    user_id: str | None = Query(default=None),
    role: str | None = Query(default=None),
    question: str | None = Query(default=None),
    _: UserProfile = Depends(require_log_viewer),
    service: QueryService = Depends(get_query_service),
) -> list[QueryLogRecord]:
    return service.list_logs(limit=limit, user_id=user_id, role=role, question=question)


@router.get("/logs/export")
def export_query_logs(
    limit: int = Query(default=200, ge=1, le=1000),
    user_id: str | None = Query(default=None),
    role: str | None = Query(default=None),
    question: str | None = Query(default=None),
    _: UserProfile = Depends(require_log_viewer),
    service: QueryService = Depends(get_query_service),
) -> StreamingResponse:
    records = service.list_logs(limit=limit, user_id=user_id, role=role, question=question)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["log_id", "user_id", "role", "question", "rewritten_query", "confidence", "latency_ms", "created_at"])
    for record in records:
        writer.writerow(
            [
                record.log_id or "",
                record.user_id,
                record.role or "",
                record.question,
                record.rewritten_query,
                record.confidence,
                record.latency_ms,
                record.created_at.isoformat() if record.created_at else "",
            ]
        )

    output = io.BytesIO(buffer.getvalue().encode("utf-8-sig"))
    headers = {"Content-Disposition": 'attachment; filename="query-logs.csv"'}
    return StreamingResponse(output, media_type="text/csv; charset=utf-8", headers=headers)


@router.post("/debug", response_model=RetrievalDebugResponse)
def debug_retrieval(
    payload: QueryRequest,
    limit: int = Query(default=20, ge=1, le=100),
    user: UserProfile = Depends(get_current_user),
    service: QueryService = Depends(get_query_service),
) -> RetrievalDebugResponse:
    return service.debug_retrieval(payload, user, limit=limit)


@router.post("/evaluate", response_model=RetrievalEvaluationResponse)
def evaluate_retrieval(
    payload: RetrievalEvaluationRequest,
    user: UserProfile = Depends(get_current_user),
    service: QueryService = Depends(get_query_service),
) -> RetrievalEvaluationResponse:
    return service.evaluate_retrieval(payload, user)
