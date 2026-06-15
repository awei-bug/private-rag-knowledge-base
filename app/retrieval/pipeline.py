from __future__ import annotations

from app.models.auth import UserProfile
from app.core.config import get_settings
from app.ingestion.store import DocumentStore
from app.models.query import QueryRequest
from app.models.settings import UserPreferences
from app.retrieval.embeddings import EmbeddingProvider
from app.retrieval.fulltext import FullTextSearch, NoopFullTextSearch
from app.retrieval.types import RetrievedChunk, RetrievalResult


class RetrievalPipeline:
    def __init__(
        self,
        store: DocumentStore,
        embedder: EmbeddingProvider,
        full_text: FullTextSearch | None = None,
    ) -> None:
        self.store = store
        self.embedder = embedder
        self.full_text = full_text or NoopFullTextSearch()
        self.settings = get_settings()
        self.override_top_k: int | None = None
        self.preferences = UserPreferences()

    def apply_preferences(self, preferences: UserPreferences) -> None:
        self.override_top_k = preferences.top_k
        self.preferences = preferences

    def run(self, request: QueryRequest, user: UserProfile) -> RetrievalResult:
        rewritten_query = self._rewrite_query(request)
        candidates = self._hybrid_retrieve(rewritten_query, request, user)
        reranked = self._rerank(rewritten_query, candidates)
        effective_top_k = request.top_k or self.override_top_k or self.settings.retrieval_top_k
        filtered = [
            chunk for chunk in reranked[:effective_top_k]
            if chunk.score >= self.settings.min_score_threshold
        ]
        return RetrievalResult(rewritten_query=rewritten_query, chunks=filtered)

    def debug(self, request: QueryRequest, user: UserProfile, limit: int = 20) -> RetrievalResult:
        rewritten_query = self._rewrite_query(request)
        candidates = self._hybrid_retrieve(rewritten_query, request, user)
        reranked = self._rerank(rewritten_query, candidates)
        effective_limit = min(limit, request.top_k or self.override_top_k or limit)
        return RetrievalResult(rewritten_query=rewritten_query, chunks=reranked[:effective_limit])

    def _rewrite_query(self, request: QueryRequest) -> str:
        normalized = request.question.strip()
        if not normalized:
            return request.question
        rewrite_enabled = (
            request.query_rewrite_enabled
            if request.query_rewrite_enabled is not None
            else self.preferences.query_rewrite_enabled
        )
        if not rewrite_enabled:
            return normalized
        return normalized.replace("RAG", "retrieval augmented generation")

    def _hybrid_retrieve(
        self,
        query: str,
        request: QueryRequest,
        user: UserProfile,
    ) -> list[RetrievedChunk]:
        query_terms = {term.lower() for term in query.split()}
        query_embedding = self.embedder.embed_text(query)
        full_text_scores = self.full_text.search(query, limit=self.settings.opensearch_candidate_limit)
        results: list[RetrievedChunk] = []

        candidate_chunks = self.store.search_vector_candidates(
            query_embedding=query_embedding,
            limit=self.settings.vector_candidate_limit,
        )

        for chunk in candidate_chunks:
            effective_acl = chunk.chunk_acl or chunk.document_acl
            if user.allowed_acl and effective_acl:
                if not set(user.allowed_acl).intersection(effective_acl):
                    continue

            if request.filters:
                mismatched = [
                    key for key, value in request.filters.items()
                    if chunk.metadata.get(key) != value
                ]
                if mismatched:
                    continue

            token_hits = sum(1 for term in query_terms if term in chunk.content.lower())
            token_score = token_hits / max(len(query_terms), 1)
            lexical_score = max(token_score, full_text_scores.get(chunk.chunk_id, 0.0))
            semantic_score = (
                chunk.semantic_score
                if chunk.semantic_score is not None
                else self.embedder.cosine_similarity(query_embedding, chunk.embedding)
            )
            meta_hits = sum(
                1 for key, value in request.filters.items() if chunk.metadata.get(key) == value
            )
            if request.retrieval_mode == "precise":
                score = lexical_score + 0.05 * meta_hits
            elif request.retrieval_mode == "semantic":
                score = semantic_score + 0.05 * meta_hits
            else:
                score = (
                    self.preferences.lexical_weight * lexical_score
                    + self.preferences.semantic_weight * semantic_score
                    + self.settings.opensearch_weight * full_text_scores.get(chunk.chunk_id, 0.0)
                    + 0.05 * meta_hits
                )
            if score <= 0:
                continue
            results.append(
                RetrievedChunk(
                    chunk_id=chunk.chunk_id,
                    document_id=chunk.document_id,
                    document_title=chunk.document_title,
                    content=chunk.content,
                    score=score,
                    lexical_score=lexical_score,
                    semantic_score=semantic_score,
                    acl=effective_acl,
                    metadata=chunk.metadata,
                )
            )
        return results

    def _rerank(self, query: str, candidates: list[RetrievedChunk]) -> list[RetrievedChunk]:
        query_terms = {term.lower() for term in query.split()}
        prefixes = tuple(query_terms)
        for chunk in candidates:
            proximity_bonus = 0.04 if prefixes and chunk.content.lower().startswith(prefixes) else 0.0
            chunk.score += proximity_bonus + 0.03 * min(chunk.semantic_score, 1.0)
        return sorted(candidates, key=lambda item: item.score, reverse=True)
