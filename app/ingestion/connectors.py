from __future__ import annotations

import hashlib
from pathlib import Path

from app.ingestion.parsers import parse_supported_file
from app.models.document import DocumentIngestRequest, LocalDirectorySyncRequest


class LocalDirectoryConnector:
    def sync(self, request: LocalDirectorySyncRequest) -> tuple[list[DocumentIngestRequest], list[str], int]:
        root = Path(request.root_path).expanduser().resolve()
        if not root.exists():
            raise FileNotFoundError(f"Directory not found: {root}")
        if not root.is_dir():
            raise NotADirectoryError(f"Path is not a directory: {root}")

        allowed_extensions = {extension.lower() for extension in request.extensions}
        iterator = root.rglob("*") if request.recursive else root.glob("*")

        documents: list[DocumentIngestRequest] = []
        skipped: list[str] = []
        scanned = 0

        for path in iterator:
            if not path.is_file():
                continue
            scanned += 1
            if scanned > request.max_files:
                skipped.append(f"Reached max_files={request.max_files}; remaining files skipped.")
                break
            if path.suffix.lower() not in allowed_extensions:
                skipped.append(f"{path}: unsupported extension")
                continue
            try:
                title, content = parse_supported_file(path)
            except Exception as exc:
                skipped.append(f"{path}: {exc}")
                continue

            relative_path = path.relative_to(root).as_posix()
            digest = hashlib.sha1(relative_path.encode("utf-8")).hexdigest()[:16]
            metadata = {
                **request.default_metadata,
                "file_name": path.name,
                "file_path": str(path),
                "relative_path": relative_path,
                "file_ext": path.suffix.lower(),
                "source_type": "local_file",
                "modified_at": str(int(path.stat().st_mtime)),
            }
            documents.append(
                DocumentIngestRequest(
                    document_id=f"local-{digest}",
                    title=title,
                    source=f"{request.source_label}:{relative_path}",
                    content=content,
                    acl=request.default_acl,
                    metadata=metadata,
                )
            )

        return documents, skipped, scanned
