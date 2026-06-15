from __future__ import annotations

from typing import Protocol

from sqlalchemy import and_, delete, select, text
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.db.capabilities import has_pgvector
from app.db.models import DocumentChunkORM, DocumentORM, QueryLogORM
from app.models.audit import QueryLogRecord
from app.models.document import DocumentChunk, DocumentResponse
from app.models.query import Citation
from app.retrieval.embeddings import EmbeddingProvider
from app.retrieval.types import StoredChunk


class DocumentStore(Protocol):
    def upsert_document(self, document: DocumentResponse) -> None:
        ...

    def get_document(self, document_id: str) -> DocumentResponse | None:
        ...

    def list_documents(self) -> list[DocumentResponse]:
        ...

    def list_chunks(self, document_id: str) -> list[DocumentChunk] | None:
        ...

    def delete_document(self, document_id: str) -> bool:
        ...

    def update_document(
        self,
        document_id: str,
        *,
        title: str | None = None,
        source: str | None = None,
        metadata: dict[str, str] | None = None,
    ) -> DocumentResponse | None:
        ...

    def get_all_documents(self) -> list[DocumentResponse]:
        ...

    def get_retrieval_chunks(self) -> list[StoredChunk]:
        ...

    def search_vector_candidates(
        self,
        query_embedding: list[float],
        limit: int,
    ) -> list[StoredChunk]:
        ...


class AuditStore(Protocol):
    def log_query(self, record: QueryLogRecord) -> None:
        ...

    def list_logs(
        self,
        limit: int = 50,
        user_id: str | None = None,
        role: str | None = None,
        question: str | None = None,
    ) -> list[QueryLogRecord]:
        ...


def _to_document_response(model: DocumentORM) -> DocumentResponse:
    return DocumentResponse(
        document_id=model.document_id,
        title=model.title,
        source=model.source,
        acl=model.acl or [],
        metadata=model.metadata_json or {},
        file_path=model.file_path,
        chunks=[
            DocumentChunk(
                chunk_id=chunk.chunk_id,
                content=chunk.content,
                acl=_chunk_acl(chunk.metadata_json or {}, model.acl or []),
                metadata=chunk.metadata_json or {},
            )
            for chunk in model.chunks
        ],
    )


def _vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(f"{value:.8f}" for value in vector) + "]"


def _vector_storage_value(vector: list[float]) -> str | None:
    if not has_pgvector():
        return None
    return _vector_literal(vector)


def _chunk_acl(metadata: dict[str, str], document_acl: list[str]) -> list[str]:
    explicit_acl = metadata.get("chunk_acl") or metadata.get("acl")
    if not explicit_acl:
        return document_acl
    if isinstance(explicit_acl, str):
        return [item.strip() for item in explicit_acl.split(",") if item.strip()]
    return document_acl


class SqlDocumentStore:
    def __init__(self, session_factory: sessionmaker, embedder: EmbeddingProvider) -> None:
        self.session_factory = session_factory
        self.embedder = embedder
        self.settings = get_settings()

    def upsert_document(self, document: DocumentResponse) -> None:
        with self.session_factory() as session:
            existing = session.get(DocumentORM, document.document_id)
            if existing is None:
                existing = DocumentORM(
                    document_id=document.document_id,
                    title=document.title,
                    source=document.source,
                    acl=document.acl,
                    metadata_json=document.metadata,
                    file_path=document.file_path,
                )
                session.add(existing)
            else:
                existing.title = document.title
                existing.source = document.source
                existing.acl = document.acl
                existing.metadata_json = document.metadata
                existing.file_path = document.file_path
                session.execute(
                    delete(DocumentChunkORM).where(DocumentChunkORM.document_id == document.document_id)
                )
                session.flush()
                session.expire(existing, ["chunks"])

            chunks: list[DocumentChunkORM] = []
            for chunk in document.chunks:
                embedding = self.embedder.embed_text(chunk.content)
                metadata = {**chunk.metadata}
                if chunk.acl:
                    metadata["chunk_acl"] = ",".join(chunk.acl)
                chunks.append(
                    DocumentChunkORM(
                        chunk_id=chunk.chunk_id,
                        content=chunk.content,
                        metadata_json=metadata,
                        embedding_json=embedding,
                        embedding_vector=_vector_storage_value(embedding),
                    )
                )
            existing.chunks = chunks
            session.commit()

    def list_documents(self) -> list[DocumentResponse]:
        with self.session_factory() as session:
            documents = session.scalars(select(DocumentORM).order_by(DocumentORM.created_at.desc())).all()
            return [_to_document_response(document) for document in documents]

    def get_document(self, document_id: str) -> DocumentResponse | None:
        with self.session_factory() as session:
            document = session.get(DocumentORM, document_id)
            if document is None:
                return None
            return _to_document_response(document)

    def list_chunks(self, document_id: str) -> list[DocumentChunk] | None:
        document = self.get_document(document_id)
        if document is None:
            return None
        return document.chunks

    def delete_document(self, document_id: str) -> bool:
        with self.session_factory() as session:
            document = session.get(DocumentORM, document_id)
            if document is None:
                return False
            session.delete(document)
            session.commit()
            return True

    def update_document(
        self,
        document_id: str,
        *,
        title: str | None = None,
        source: str | None = None,
        metadata: dict[str, str] | None = None,
    ) -> DocumentResponse | None:
        with self.session_factory() as session:
            document = session.get(DocumentORM, document_id)
            if document is None:
                return None
            if title is not None:
                document.title = title
            if source is not None:
                document.source = source
            if metadata is not None:
                document.metadata_json = metadata
                document.file_path = metadata.get("stored_file_path", document.file_path)
                for chunk in document.chunks:
                    chunk_metadata = dict(chunk.metadata_json or {})
                    chunk_acl = chunk_metadata.get("chunk_acl")
                    chunk.metadata_json = {**metadata, **({"chunk_acl": chunk_acl} if chunk_acl else {})}
            session.commit()
            session.refresh(document)
            return _to_document_response(document)

    def get_all_documents(self) -> list[DocumentResponse]:
        return self.list_documents()

    def get_retrieval_chunks(self) -> list[StoredChunk]:
        with self.session_factory() as session:
            documents = session.scalars(select(DocumentORM).order_by(DocumentORM.created_at.desc())).all()
            chunks: list[StoredChunk] = []
            for document in documents:
                for chunk in document.chunks:
                    chunks.append(
                        StoredChunk(
                            chunk_id=chunk.chunk_id,
                            document_id=document.document_id,
                            document_title=document.title,
                            document_acl=document.acl or [],
                            chunk_acl=_chunk_acl(chunk.metadata_json or {}, document.acl or []),
                            content=chunk.content,
                            metadata=chunk.metadata_json or {},
                            embedding=chunk.embedding_json or self.embedder.embed_text(chunk.content),
                        )
                    )
            return chunks

    def search_vector_candidates(
        self,
        query_embedding: list[float],
        limit: int,
    ) -> list[StoredChunk]:
        if not has_pgvector():
            return self.get_retrieval_chunks()

        query_vector = _vector_literal(query_embedding)
        sql = text(
            """
            SELECT
                c.chunk_id,
                c.document_id,
                d.title AS document_title,
                d.acl,
                c.content,
                c.metadata_json,
                c.embedding_json,
                1 - (c.embedding_vector <=> CAST(:query_vector AS vector)) AS semantic_score
            FROM document_chunks c
            JOIN documents d ON d.document_id = c.document_id
            WHERE c.embedding_vector IS NOT NULL
            ORDER BY c.embedding_vector <=> CAST(:query_vector AS vector)
            LIMIT :limit
            """
        )
        with self.session_factory() as session:
            rows = session.execute(
                sql,
                {"query_vector": query_vector, "limit": limit},
            ).mappings()
            chunks = [
                StoredChunk(
                    chunk_id=row["chunk_id"],
                    document_id=row["document_id"],
                    document_title=row["document_title"],
                    document_acl=row["acl"] or [],
                    chunk_acl=_chunk_acl(row["metadata_json"] or {}, row["acl"] or []),
                    content=row["content"],
                    metadata=row["metadata_json"] or {},
                    embedding=row["embedding_json"] or [],
                    semantic_score=max(float(row["semantic_score"] or 0.0), 0.0),
                )
                for row in rows
            ]
        return chunks or self.get_retrieval_chunks()


class SqlAuditStore:
    def __init__(self, session_factory: sessionmaker) -> None:
        self.session_factory = session_factory

    def log_query(self, record: QueryLogRecord) -> None:
        with self.session_factory() as session:
            model = QueryLogORM(
                user_id=record.user_id,
                role=record.role,
                question=record.question,
                rewritten_query=record.rewritten_query,
                answer=record.answer,
                confidence=record.confidence,
                filters_json=record.filters,
                citations_json=[citation.model_dump() for citation in record.citations],
                latency_ms=record.latency_ms,
            )
            session.add(model)
            session.commit()

    def list_logs(
        self,
        limit: int = 50,
        user_id: str | None = None,
        role: str | None = None,
        question: str | None = None,
    ) -> list[QueryLogRecord]:
        with self.session_factory() as session:
            filters = []
            if user_id:
                filters.append(QueryLogORM.user_id == user_id)
            if role:
                filters.append(QueryLogORM.role == role)
            if question:
                filters.append(QueryLogORM.question.ilike(f"%{question}%"))

            statement = select(QueryLogORM).order_by(QueryLogORM.created_at.desc()).limit(limit)
            if filters:
                statement = statement.where(and_(*filters))

            logs = session.scalars(statement).all()
            return [
                QueryLogRecord(
                    log_id=log.log_id,
                    user_id=log.user_id,
                    role=log.role,
                    question=log.question,
                    rewritten_query=log.rewritten_query,
                    answer=log.answer,
                    confidence=log.confidence,
                    filters=log.filters_json or {},
                    citations=[Citation(**citation) for citation in (log.citations_json or [])],
                    latency_ms=log.latency_ms,
                    created_at=log.created_at,
                )
                for log in logs
            ]
