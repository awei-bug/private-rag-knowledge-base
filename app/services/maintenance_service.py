from __future__ import annotations

import json
from datetime import UTC, datetime
from hashlib import sha1
from pathlib import Path

from sqlalchemy import delete
from sqlalchemy.orm import sessionmaker

from app.db.models import QueryLogORM
from app.ingestion.store import SqlAuditStore, SqlDocumentStore
from app.models.audit import QueryLogRecord
from app.models.document import DocumentResponse
from app.models.maintenance import BackupBundle, MaintenanceActionResponse
from app.models.maintenance import BackupManifestItem, BackupManifestResponse, BackupValidationResponse
from app.retrieval.fulltext import FullTextSearch
from app.storage import LocalObjectStorage


class MaintenanceService:
    def __init__(
        self,
        session_factory: sessionmaker,
        document_store: SqlDocumentStore,
        audit_store: SqlAuditStore,
        full_text: FullTextSearch,
    ) -> None:
        self.session_factory = session_factory
        self.document_store = document_store
        self.audit_store = audit_store
        self.full_text = full_text
        self.object_storage = LocalObjectStorage()
        self.backup_root = Path("./data/backups").resolve()

    def rebuild_indexes(self) -> MaintenanceActionResponse:
        documents = self.document_store.get_all_documents()
        for document in documents:
            self.document_store.upsert_document(document)
            self.full_text.index_document(document)

        chunk_count = sum(len(document.chunks) for document in documents)
        return MaintenanceActionResponse(
            action="rebuild-indexes",
            success=True,
            document_count=len(documents),
            chunk_count=chunk_count,
            message="Indexes rebuilt successfully.",
        )

    def export_backup(self) -> BackupBundle:
        documents = self.document_store.get_all_documents()
        query_logs = self.audit_store.list_logs(limit=5000)
        return BackupBundle(
            exported_at=datetime.now(UTC),
            document_count=len(documents),
            query_log_count=len(query_logs),
            documents=documents,
            query_logs=query_logs,
        )

    def export_backup_json(self) -> str:
        return json.dumps(self.export_backup().model_dump(mode="json"), ensure_ascii=False, indent=2)

    def create_backup_file(self) -> BackupValidationResponse:
        self.backup_root.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
        filename = f"rag-backup-{stamp}.json"
        path = self.backup_root / filename
        path.write_text(self.export_backup_json(), encoding="utf-8")
        return self.verify_backup_file(filename)

    def list_backup_files(self) -> BackupManifestResponse:
        self.backup_root.mkdir(parents=True, exist_ok=True)
        items: list[BackupManifestItem] = []
        for path in sorted(self.backup_root.glob("rag-backup-*.json"), reverse=True):
            validation = self._validate_backup_path(path)
            stat = path.stat()
            created_at = datetime.fromtimestamp(stat.st_mtime, tz=UTC)
            items.append(
                BackupManifestItem(
                    filename=path.name,
                    path=str(path),
                    created_at=created_at,
                    size_bytes=stat.st_size,
                    document_count=validation.document_count,
                    query_log_count=validation.query_log_count,
                    valid=validation.valid,
                )
            )
        return BackupManifestResponse(items=items)

    def verify_backup_file(self, filename: str) -> BackupValidationResponse:
        path = (self.backup_root / filename).resolve()
        if self.backup_root not in path.parents and path != self.backup_root:
            return BackupValidationResponse(filename=filename, valid=False, message="Invalid backup path.")
        return self._validate_backup_path(path)

    def _validate_backup_path(self, path: Path) -> BackupValidationResponse:
        if not path.exists() or not path.is_file():
            return BackupValidationResponse(filename=path.name, valid=False, message="Backup file not found.")
        try:
            raw = path.read_text(encoding="utf-8")
            bundle = BackupBundle.model_validate_json(raw)
        except Exception as exc:
            return BackupValidationResponse(filename=path.name, valid=False, message=f"Invalid backup: {exc}")
        return BackupValidationResponse(
            filename=path.name,
            valid=True,
            document_count=len(bundle.documents),
            query_log_count=len(bundle.query_logs),
            message="Backup is valid.",
        )

    def restore_backup(self, bundle: BackupBundle) -> MaintenanceActionResponse:
        with self.session_factory() as session:
            session.execute(delete(QueryLogORM))
            session.commit()

        for document in self.document_store.get_all_documents():
            self.document_store.delete_document(document.document_id)

        for document in bundle.documents:
            restored = DocumentResponse.model_validate(document)
            self.document_store.upsert_document(restored)
            self.full_text.index_document(restored)

        for record in bundle.query_logs:
            self.audit_store.log_query(QueryLogRecord.model_validate(record))

        chunk_count = sum(len(document.chunks) for document in bundle.documents)
        return MaintenanceActionResponse(
            action="restore-backup",
            success=True,
            document_count=len(bundle.documents),
            chunk_count=chunk_count,
            message="Backup restored successfully.",
        )

    def cleanup_duplicates(self) -> MaintenanceActionResponse:
        documents = self.document_store.get_all_documents()
        seen: dict[str, str] = {}
        removed = 0

        for document in sorted(documents, key=lambda item: item.document_id):
            digest = sha1("".join(chunk.content for chunk in document.chunks).encode("utf-8")).hexdigest()
            if digest in seen:
                self.document_store.delete_document(document.document_id)
                self.object_storage.delete_file(document.file_path)
                removed += 1
            else:
                seen[digest] = document.document_id

        remaining_documents = self.document_store.get_all_documents()
        return MaintenanceActionResponse(
            action="cleanup-duplicates",
            success=True,
            document_count=len(remaining_documents),
            chunk_count=sum(len(document.chunks) for document in remaining_documents),
            message=f"Removed {removed} duplicate documents.",
        )

    def cleanup_orphans(self, storage_root: str | None = None) -> MaintenanceActionResponse:
        root = Path(storage_root).resolve() if storage_root else self.object_storage.root
        root.mkdir(parents=True, exist_ok=True)

        linked_files = {
            Path(document.file_path).resolve()
            for document in self.document_store.get_all_documents()
            if document.file_path
        }

        removed = 0
        for file_path in root.glob("*"):
            if file_path.is_file() and file_path.resolve() not in linked_files:
                file_path.unlink(missing_ok=True)
                removed += 1

        return MaintenanceActionResponse(
            action="cleanup-orphans",
            success=True,
            document_count=removed,
            chunk_count=0,
            message=f"Removed {removed} orphan files.",
        )
