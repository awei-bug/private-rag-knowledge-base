import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.auth import get_current_user, require_roles
from app.dependencies import get_document_service
from app.ingestion.service import DocumentIngestionService
from app.models.auth import UserProfile
from app.models.document import (
    DocumentBatchDeleteRequest,
    DocumentBatchDeleteResponse,
    DocumentBatchUpdateRequest,
    DocumentBatchUpdateResponse,
    DocumentChunk,
    DocumentIngestRequest,
    DocumentMoveRequest,
    DocumentMoveResponse,
    DocumentRenameFileRequest,
    DocumentResponse,
    DocumentUpdateRequest,
    DocumentUploadRequest,
    LocalDirectorySyncRequest,
    LocalDirectorySyncResponse,
)

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post(
    "/ingest",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
def ingest_document(
    payload: DocumentIngestRequest,
    _: UserProfile = Depends(require_roles("admin", "editor")),
    service: DocumentIngestionService = Depends(get_document_service),
) -> DocumentResponse:
    return service.ingest(payload)


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    _: UserProfile = Depends(get_current_user),
    service: DocumentIngestionService = Depends(get_document_service),
) -> list[DocumentResponse]:
    return service.list_documents()


@router.post("/sync/local-dir", response_model=LocalDirectorySyncResponse)
def sync_local_directory(
    payload: LocalDirectorySyncRequest,
    _: UserProfile = Depends(require_roles("admin", "editor")),
    service: DocumentIngestionService = Depends(get_document_service),
) -> LocalDirectorySyncResponse:
    try:
        return service.sync_local_directory(payload)
    except (FileNotFoundError, NotADirectoryError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    source: str = Form(default="uploaded-file"),
    acl: str = Form(default=""),
    metadata_json: str = Form(default="{}"),
    document_id: str | None = Form(default=None),
    title: str | None = Form(default=None),
    _: UserProfile = Depends(require_roles("admin", "editor")),
    service: DocumentIngestionService = Depends(get_document_service),
) -> DocumentResponse:
    try:
        metadata = json.loads(metadata_json) if metadata_json.strip() else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid metadata_json.") from exc

    payload = DocumentUploadRequest(
        source=source,
        acl=[item.strip() for item in acl.split(",") if item.strip()],
        metadata={str(key): str(value) for key, value in metadata.items()},
        document_id=document_id,
        title=title,
    )
    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
    try:
        return service.ingest_uploaded_file(file.filename or "upload.txt", data, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: str,
    _: UserProfile = Depends(get_current_user),
    service: DocumentIngestionService = Depends(get_document_service),
) -> DocumentResponse:
    document = service.get_document(document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return document


@router.get("/{document_id}/file")
def download_document_file(
    document_id: str,
    _: UserProfile = Depends(get_current_user),
    service: DocumentIngestionService = Depends(get_document_service),
) -> FileResponse:
    document = service.get_document(document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    if not document.file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file not found.")

    file_path = Path(document.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored file missing on disk.")

    return FileResponse(path=file_path, filename=file_path.name)


@router.get("/{document_id}/chunks", response_model=list[DocumentChunk])
def list_document_chunks(
    document_id: str,
    _: UserProfile = Depends(get_current_user),
    service: DocumentIngestionService = Depends(get_document_service),
) -> list[DocumentChunk]:
    chunks = service.list_chunks(document_id)
    if chunks is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return chunks


@router.patch("/{document_id}", response_model=DocumentResponse)
def update_document(
    document_id: str,
    payload: DocumentUpdateRequest,
    _: UserProfile = Depends(require_roles("admin", "editor")),
    service: DocumentIngestionService = Depends(get_document_service),
) -> DocumentResponse:
    document = service.update_document(document_id, payload)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return document


@router.post("/batch-delete", response_model=DocumentBatchDeleteResponse)
def batch_delete_documents(
    payload: DocumentBatchDeleteRequest,
    _: UserProfile = Depends(require_roles("admin", "editor")),
    service: DocumentIngestionService = Depends(get_document_service),
) -> DocumentBatchDeleteResponse:
    return service.batch_delete_documents(payload.document_ids)


@router.post("/batch-update", response_model=DocumentBatchUpdateResponse)
def batch_update_documents(
    payload: DocumentBatchUpdateRequest,
    _: UserProfile = Depends(require_roles("admin", "editor")),
    service: DocumentIngestionService = Depends(get_document_service),
) -> DocumentBatchUpdateResponse:
    return service.batch_update_documents(
        payload.document_ids,
        metadata_updates=payload.metadata_updates,
        source=payload.source,
    )


@router.post("/move", response_model=DocumentMoveResponse)
def move_documents(
    payload: DocumentMoveRequest,
    _: UserProfile = Depends(require_roles("admin", "editor")),
    service: DocumentIngestionService = Depends(get_document_service),
) -> DocumentMoveResponse:
    try:
        return service.move_documents(payload.document_ids, payload.folder_path)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/rename-file", response_model=DocumentResponse)
def rename_document_file(
    payload: DocumentRenameFileRequest,
    _: UserProfile = Depends(require_roles("admin", "editor")),
    service: DocumentIngestionService = Depends(get_document_service),
) -> DocumentResponse:
    try:
        document = service.rename_document_file(payload.document_id, payload.filename)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    _: UserProfile = Depends(require_roles("admin", "editor")),
    service: DocumentIngestionService = Depends(get_document_service),
) -> None:
    deleted = service.delete_document(document_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
