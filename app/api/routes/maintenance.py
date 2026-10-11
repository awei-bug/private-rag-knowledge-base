from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from app.auth import require_roles
from app.dependencies import get_maintenance_service
from app.models.auth import UserProfile
from app.models.maintenance import (
    BackupBundle,
    BackupManifestResponse,
    BackupValidationResponse,
    MaintenanceActionResponse,
    OrphanCleanupRequest,
)
from app.services.maintenance_service import MaintenanceService

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.post("/rebuild-indexes", response_model=MaintenanceActionResponse)
def rebuild_indexes(
    _: UserProfile = Depends(require_roles("admin", "editor")),
    service: MaintenanceService = Depends(get_maintenance_service),
) -> MaintenanceActionResponse:
    return service.rebuild_indexes()


@router.get("/backup/export")
def export_backup(
    _: UserProfile = Depends(require_roles("admin", "editor")),
    service: MaintenanceService = Depends(get_maintenance_service),
) -> Response:
    return Response(
        content=service.export_backup_json(),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="rag-backup.json"'},
    )


@router.post("/backup/create", response_model=BackupValidationResponse)
def create_backup(
    _: UserProfile = Depends(require_roles("admin")),
    service: MaintenanceService = Depends(get_maintenance_service),
) -> BackupValidationResponse:
    return service.create_backup_file()


@router.get("/backup/list", response_model=BackupManifestResponse)
def list_backups(
    _: UserProfile = Depends(require_roles("admin")),
    service: MaintenanceService = Depends(get_maintenance_service),
) -> BackupManifestResponse:
    return service.list_backup_files()


@router.post("/backup/verify/{filename}", response_model=BackupValidationResponse)
def verify_backup(
    filename: str,
    _: UserProfile = Depends(require_roles("admin")),
    service: MaintenanceService = Depends(get_maintenance_service),
) -> BackupValidationResponse:
    return service.verify_backup_file(filename)


@router.post("/backup/restore", response_model=MaintenanceActionResponse)
async def restore_backup(
    file: UploadFile = File(...),
    _: UserProfile = Depends(require_roles("admin", "editor")),
    service: MaintenanceService = Depends(get_maintenance_service),
) -> MaintenanceActionResponse:
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded backup file is empty.")

    try:
        bundle = BackupBundle.model_validate_json(payload)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid backup file.") from exc

    return service.restore_backup(bundle)


@router.post("/cleanup-duplicates", response_model=MaintenanceActionResponse)
def cleanup_duplicates(
    _: UserProfile = Depends(require_roles("admin", "editor")),
    service: MaintenanceService = Depends(get_maintenance_service),
) -> MaintenanceActionResponse:
    return service.cleanup_duplicates()


@router.post("/cleanup-orphans", response_model=MaintenanceActionResponse)
def cleanup_orphans(
    payload: OrphanCleanupRequest,
    _: UserProfile = Depends(require_roles("admin", "editor")),
    service: MaintenanceService = Depends(get_maintenance_service),
) -> MaintenanceActionResponse:
    return service.cleanup_orphans(payload.storage_root)
