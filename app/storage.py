from __future__ import annotations

import hashlib
from pathlib import Path
import re

from app.core.config import get_settings


class LocalObjectStorage:
    def __init__(self) -> None:
        settings = get_settings()
        self.root = Path(settings.storage_local_root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def save_bytes(self, document_id: str, filename: str, data: bytes) -> str:
        suffix = Path(filename).suffix.lower()
        digest = hashlib.sha1(data).hexdigest()[:16]
        safe_name = f"{document_id}-{digest}{suffix}"
        target = self.root / safe_name
        target.write_bytes(data)
        return str(target)

    def delete_file(self, stored_path: str | None) -> None:
        if not stored_path:
            return
        path = Path(stored_path)
        if path.exists() and path.is_file():
            path.unlink(missing_ok=True)

    def move_file(self, stored_path: str | None, folder_path: str) -> str | None:
        if not stored_path:
            return None
        path = Path(stored_path).resolve()
        if not path.exists() or not path.is_file():
            return str(path)
        try:
            path.relative_to(self.root)
        except ValueError:
            return str(path)

        normalized_folder = self._normalize_folder(folder_path)
        target_dir = self.root / normalized_folder if normalized_folder != Path(".") else self.root
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / path.name
        if target == path:
            return str(target)
        path.replace(target)
        return str(target)

    def rename_file(self, stored_path: str | None, filename: str) -> str | None:
        if not stored_path:
            return None
        path = Path(stored_path).resolve()
        if not path.exists() or not path.is_file():
            return str(path)
        try:
            parent = path.parent.resolve()
            parent.relative_to(self.root)
        except ValueError:
            return str(path)

        safe_name = self._sanitize_filename(filename)
        target = parent / safe_name
        if target == path:
            return str(target)
        path.replace(target)
        return str(target)

    def _normalize_folder(self, folder_path: str) -> Path:
        raw = Path(folder_path.strip().replace("\\", "/"))
        parts = [part for part in raw.parts if part not in {"", "."}]
        if any(part == ".." for part in parts):
            raise ValueError("Folder path cannot contain parent directory traversal.")
        return Path(*parts) if parts else Path(".")

    def _sanitize_filename(self, filename: str) -> str:
        cleaned = filename.strip().replace("\\", "/").split("/")[-1]
        if not cleaned or cleaned in {".", ".."}:
            raise ValueError("Filename is invalid.")
        cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", cleaned)
        if cleaned.startswith("."):
            cleaned = cleaned.lstrip(".")
        if not cleaned:
            raise ValueError("Filename is invalid.")
        return cleaned
