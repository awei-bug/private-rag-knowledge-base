from datetime import datetime

from pydantic import BaseModel, Field

from app.models.audit import QueryLogRecord
from app.models.document import DocumentResponse


class MaintenanceActionResponse(BaseModel):
    action: str
    success: bool
    document_count: int = 0
    chunk_count: int = 0
    message: str


class OrphanCleanupRequest(BaseModel):
    storage_root: str | None = None


class BackupBundle(BaseModel):
    exported_at: datetime
    document_count: int = 0
    query_log_count: int = 0
    documents: list[DocumentResponse] = Field(default_factory=list)
    query_logs: list[QueryLogRecord] = Field(default_factory=list)


class BackupManifestItem(BaseModel):
    filename: str
    path: str
    created_at: datetime
    size_bytes: int
    document_count: int = 0
    query_log_count: int = 0
    valid: bool = False


class BackupManifestResponse(BaseModel):
    items: list[BackupManifestItem] = Field(default_factory=list)


class BackupValidationResponse(BaseModel):
    filename: str
    valid: bool
    document_count: int = 0
    query_log_count: int = 0
    message: str
