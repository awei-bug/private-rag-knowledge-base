from app.generation.providers import LLMProvider
from app.models.query import QueryResponse
from app.retrieval.types import RetrievalResult


class AnswerGenerationService:
    def __init__(self, provider: LLMProvider) -> None:
        self.provider = provider

    def generate(self, question: str, result: RetrievalResult) -> QueryResponse:
        answer = self.provider.generate(question, result.chunks)
        citations = [
            {
                "document_id": chunk.document_id,
                "document_title": chunk.document_title,
                "chunk_id": chunk.chunk_id,
                "score": round(chunk.score, 4),
                "content_preview": chunk.content[:240],
            }
            for chunk in result.chunks
        ]
        confidence = round(result.chunks[0].score, 4) if result.chunks else 0.0
        return QueryResponse(
            answer=answer,
            citations=citations,
            confidence=confidence,
            rewritten_query=result.rewritten_query,
        )
