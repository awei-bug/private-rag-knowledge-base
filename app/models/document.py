from pydantic import BaseModel, Field


class DocumentChunk(BaseModel):
    chunk_id: str
    content: str
    acl: list[str] = Field(default_factory=list)
    metadata: dict[str, str] = Field(default_factory=dict)


class DocumentIngestRequest(BaseModel):
    document_id: str
    title: str
    source: str
    content: str = Field(min_length=1)
    acl: list[str] = Field(default_factory=list)
    metadata: dict[str, str] = Field(default_factory=dict)


class DocumentResponse(BaseModel):
    document_id: str
    title: str
    source: str
    acl: list[str] = Field(default_factory=list)
    metadata: dict[str, str] = Field(default_factory=dict)
    file_path: str | None = None
    chunks: list[DocumentChunk] = Field(default_factory=list)


class LocalDirectorySyncRequest(BaseModel):
    root_path: str
    recursive: bool = True
    extensions: list[str] = Field(
        default_factory=lambda: [".txt", ".md", ".json", ".pdf", ".docx", ".xlsx", ".xlsm"]
    )
    default_acl: list[str] = Field(default_factory=list)
    default_metadata: dict[str, str] = Field(default_factory=dict)
    source_label: str = "local-filesystem"
    max_files: int = Field(default=500, ge=1, le=5000)


class LocalDirectorySyncResponse(BaseModel):
    root_path: str
    scanned_files: int
    imported_documents: int
    skipped_files: int
    document_ids: list[str] = Field(default_factory=list)
    skipped_reasons: list[str] = Field(default_factory=list)


class DocumentUploadRequest(BaseModel):
    source: str = "uploaded-file"
    acl: list[str] = Field(default_factory=list)
    metadata: dict[str, str] = Field(default_factory=dict)
    document_id: str | None = None
    title: str | None = None


class DocumentUpdateRequest(BaseModel):
    title: str | None = None
    source: str | None = None
    metadata: dict[str, str] | None = None


class DocumentBatchDeleteRequest(BaseModel):
    document_ids: list[str] = Field(default_factory=list, min_length=1)


class DocumentBatchDeleteResponse(BaseModel):
    deleted_count: int
    missing_document_ids: list[str] = Field(default_factory=list)


class DocumentBatchUpdateRequest(BaseModel):
    document_ids: list[str] = Field(default_factory=list, min_length=1)
    metadata_updates: dict[str, str] = Field(default_factory=dict)
    source: str | None = None


class DocumentBatchUpdateResponse(BaseModel):
    updated_count: int
    missing_document_ids: list[str] = Field(default_factory=list)


class DocumentMoveRequest(BaseModel):
    document_ids: list[str] = Field(default_factory=list, min_length=1)
    folder_path: str = Field(min_length=1)


class DocumentMoveResponse(BaseModel):
    moved_count: int
    missing_document_ids: list[str] = Field(default_factory=list)


class DocumentRenameFileRequest(BaseModel):
    document_id: str
    filename: str = Field(min_length=1)
