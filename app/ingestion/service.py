import hashlib
from pathlib import Path

from app.ingestion.connectors import LocalDirectoryConnector
from app.core.config import get_settings
from app.ingestion.chunking import chunk_text
from app.ingestion.parsers import parse_uploaded_bytes
from app.ingestion.store import DocumentStore
from app.models.document import (
    DocumentBatchDeleteResponse,
    DocumentBatchUpdateResponse,
    DocumentChunk,
    DocumentIngestRequest,
    DocumentMoveResponse,
    DocumentResponse,
    DocumentUpdateRequest,
    DocumentUploadRequest,
    LocalDirectorySyncRequest,
    LocalDirectorySyncResponse,
)
from app.retrieval.fulltext import FullTextSearch, NoopFullTextSearch
from app.storage import LocalObjectStorage


class DocumentIngestionService:
    def __init__(self, store: DocumentStore, full_text: FullTextSearch | None = None) -> None:
        self.store = store
        self.full_text = full_text or NoopFullTextSearch()
        self.settings = get_settings()
        self.local_connector = LocalDirectoryConnector()
        self.object_storage = LocalObjectStorage()

    def ingest(self, payload: DocumentIngestRequest) -> DocumentResponse:
        chunks = [
            DocumentChunk(
                chunk_id=f"{payload.document_id}-chunk-{index + 1}",
                content=content,
                metadata=payload.metadata,
            )
            for index, content in enumerate(
                chunk_text(
                    payload.content,
                    chunk_size=self.settings.chunk_size,
                    chunk_overlap=self.settings.chunk_overlap,
                )
            )
        ]
        document = DocumentResponse(
            document_id=payload.document_id,
            title=payload.title,
            source=payload.source,
            acl=payload.acl,
            metadata=payload.metadata,
            file_path=payload.metadata.get("stored_file_path"),
            chunks=chunks,
        )
        self.store.upsert_document(document)
        self.full_text.index_document(document)
        return document

    def list_documents(self) -> list[DocumentResponse]:
        return self.store.list_documents()

    def get_document(self, document_id: str) -> DocumentResponse | None:
        return self.store.get_document(document_id)

    def list_chunks(self, document_id: str) -> list[DocumentChunk] | None:
        return self.store.list_chunks(document_id)

    def delete_document(self, document_id: str) -> bool:
        deleted = self.store.delete_document(document_id)
        if deleted:
            self.full_text.delete_document(document_id)
        return deleted

    def update_document(self, document_id: str, payload: DocumentUpdateRequest) -> DocumentResponse | None:
        document = self.store.update_document(
            document_id,
            title=payload.title,
            source=payload.source,
            metadata=payload.metadata,
        )
        if document is None:
            return None
        self.full_text.index_document(document)
        return document

    def batch_delete_documents(self, document_ids: list[str]) -> DocumentBatchDeleteResponse:
        deleted_count = 0
        missing_document_ids: list[str] = []
        for document_id in document_ids:
            deleted = self.delete_document(document_id)
            if deleted:
                deleted_count += 1
            else:
                missing_document_ids.append(document_id)
        return DocumentBatchDeleteResponse(
            deleted_count=deleted_count,
            missing_document_ids=missing_document_ids,
        )

    def batch_update_documents(
        self,
        document_ids: list[str],
        *,
        metadata_updates: dict[str, str],
        source: str | None = None,
    ) -> DocumentBatchUpdateResponse:
        updated_count = 0
        missing_document_ids: list[str] = []
        for document_id in document_ids:
            document = self.get_document(document_id)
            if document is None:
                missing_document_ids.append(document_id)
                continue
            next_metadata = {**document.metadata, **metadata_updates}
            updated = self.store.update_document(
                document_id,
                source=source if source is not None else document.source,
                metadata=next_metadata,
            )
            if updated is None:
                missing_document_ids.append(document_id)
                continue
            self.full_text.index_document(updated)
            updated_count += 1
        return DocumentBatchUpdateResponse(
            updated_count=updated_count,
            missing_document_ids=missing_document_ids,
        )

    def move_documents(self, document_ids: list[str], folder_path: str) -> DocumentMoveResponse:
        moved_count = 0
        missing_document_ids: list[str] = []
        for document_id in document_ids:
            document = self.get_document(document_id)
            if document is None:
                missing_document_ids.append(document_id)
                continue
            next_metadata = {**document.metadata, "folder_path": folder_path}
            moved_file_path = self.object_storage.move_file(document.file_path, folder_path)
            if moved_file_path:
                next_metadata["stored_file_path"] = moved_file_path
            updated = self.store.update_document(
                document_id,
                metadata=next_metadata,
            )
            if updated is None:
                missing_document_ids.append(document_id)
                continue
            self.full_text.index_document(updated)
            moved_count += 1
        return DocumentMoveResponse(
            moved_count=moved_count,
            missing_document_ids=missing_document_ids,
        )

    def rename_document_file(self, document_id: str, filename: str) -> DocumentResponse | None:
        document = self.get_document(document_id)
        if document is None:
            return None
        new_file_path = self.object_storage.rename_file(document.file_path, filename)
        next_metadata = {
            **document.metadata,
            "file_name": filename,
            "stored_file_path": new_file_path or document.file_path or "",
        }
        updated = self.store.update_document(
            document_id,
            metadata=next_metadata,
        )
        if updated is None:
            return None
        self.full_text.index_document(updated)
        return updated

    def sync_local_directory(self, payload: LocalDirectorySyncRequest) -> LocalDirectorySyncResponse:
        documents, skipped, scanned = self.local_connector.sync(payload)
        imported_ids: list[str] = []
        for document in documents:
            imported = self.ingest(document)
            imported_ids.append(imported.document_id)
        return LocalDirectorySyncResponse(
            root_path=payload.root_path,
            scanned_files=scanned,
            imported_documents=len(imported_ids),
            skipped_files=len(skipped),
            document_ids=imported_ids,
            skipped_reasons=skipped,
        )

    def ingest_uploaded_file(
        self,
        filename: str,
        data: bytes,
        payload: DocumentUploadRequest,
    ) -> DocumentResponse:
        title, content = parse_uploaded_bytes(filename, data)
        document_id = payload.document_id or self._build_uploaded_document_id(filename, data)
        stored_file_path = self.object_storage.save_bytes(document_id, filename, data)
        metadata = {
            **payload.metadata,
            "file_name": filename,
            "file_ext": Path(filename).suffix.lower(),
            "source_type": "uploaded_file",
            "stored_file_path": stored_file_path,
        }
        request = DocumentIngestRequest(
            document_id=document_id,
            title=payload.title or title,
            source=payload.source,
            content=content,
            acl=payload.acl,
            metadata=metadata,
        )
        return self.ingest(request)

    def _build_uploaded_document_id(self, filename: str, data: bytes) -> str:
        digest = hashlib.sha1(f"{filename}:{len(data)}".encode("utf-8") + data[:128]).hexdigest()[:16]
        return f"upload-{digest}"
