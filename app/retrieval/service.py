from time import perf_counter

from app.ingestion.store import AuditStore
from app.models.auth import UserProfile
from app.models.audit import QueryLogRecord
from app.generation.service import AnswerGenerationService
from app.models.query import (
    QueryRequest,
    QueryResponse,
    RetrievalDebugChunk,
    RetrievalDebugResponse,
    RetrievalEvaluationRequest,
    RetrievalEvaluationResponse,
    RetrievalEvaluationResult,
)
from app.retrieval.pipeline import RetrievalPipeline


class QueryService:
    def __init__(
        self,
        pipeline: RetrievalPipeline,
        generator: AnswerGenerationService,
        audit_store: AuditStore,
    ) -> None:
        self.pipeline = pipeline
        self.generator = generator
        self.audit_store = audit_store

    def answer(self, payload: QueryRequest, user: UserProfile) -> QueryResponse:
        start = perf_counter()
        result = self.pipeline.run(payload, user)
        response = self.generator.generate(payload.question, result)
        latency_ms = int((perf_counter() - start) * 1000)
        self.audit_store.log_query(
            QueryLogRecord(
                user_id=user.username,
                role=user.role,
                question=payload.question,
                rewritten_query=response.rewritten_query,
                answer=response.answer,
                confidence=response.confidence,
                filters=payload.filters,
                citations=response.citations,
                latency_ms=latency_ms,
            )
        )
        return response

    def list_logs(
        self,
        limit: int = 50,
        user_id: str | None = None,
        role: str | None = None,
        question: str | None = None,
    ) -> list[QueryLogRecord]:
        return self.audit_store.list_logs(limit=limit, user_id=user_id, role=role, question=question)

    def debug_retrieval(
        self,
        payload: QueryRequest,
        user: UserProfile,
        limit: int = 20,
    ) -> RetrievalDebugResponse:
        result = self.pipeline.debug(payload, user, limit=limit)
        return RetrievalDebugResponse(
            rewritten_query=result.rewritten_query,
            chunks=[
                RetrievalDebugChunk(
                    document_id=chunk.document_id,
                    document_title=chunk.document_title,
                    chunk_id=chunk.chunk_id,
                    score=round(chunk.score, 4),
                    lexical_score=round(chunk.lexical_score, 4),
                    semantic_score=round(chunk.semantic_score, 4),
                    metadata=chunk.metadata,
                    content_preview=chunk.content[:240],
                )
                for chunk in result.chunks
            ],
        )

    def evaluate_retrieval(
        self,
        payload: RetrievalEvaluationRequest,
        user: UserProfile,
    ) -> RetrievalEvaluationResponse:
        results: list[RetrievalEvaluationResult] = []
        for case in payload.cases:
            debug_result = self.pipeline.debug(
                QueryRequest(
                    question=case.question,
                    filters=case.filters,
                    retrieval_mode=case.retrieval_mode,
                ),
                user,
                limit=5,
            )
            top_document_id = debug_result.chunks[0].document_id if debug_result.chunks else None
            results.append(
                RetrievalEvaluationResult(
                    question=case.question,
                    expected_document_id=case.expected_document_id,
                    matched=top_document_id == case.expected_document_id,
                    top_document_id=top_document_id,
                    rewritten_query=debug_result.rewritten_query,
                )
            )
        return RetrievalEvaluationResponse(cases=results)
