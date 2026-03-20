from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import os
import shutil
from uuid import uuid4
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.leave.schemas import (
    LeaveRequestCreate,
    LeaveRequestOut,
    LeaveStatusUpdate,
    LeaveTypeCreate,
    LeaveTypeOut,
)
from app.leave.service import (
    create_leave,
    my_requests,
    pending_requests,
    update_status,
    get_leave_types,
    create_leave_type,
    get_my_leave_history,
)

router = APIRouter(prefix="/leave", tags=["Leave"])

UPLOAD_DIR= "uploads/medical_docs"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# TEMP until JWT connected
def get_current_employee_id():
    return 1

def get_current_manager_id():
    return 2

@router.post("/requests", response_model=LeaveRequestOut)
def submit_leave(payload: LeaveRequestCreate, db: Session = Depends(get_db)):
    try:
        return create_leave(db, get_current_employee_id(), payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/requests/me", response_model=list[LeaveRequestOut])
def get_my_leave(db: Session = Depends(get_db)):
    return my_requests(db, get_current_employee_id())

@router.get("/requests/pending", response_model=list[LeaveRequestOut])
def get_pending(db: Session = Depends(get_db)):
    return pending_requests(db)

@router.patch("/requests/{request_id}/status", response_model=LeaveRequestOut)
def change_status(request_id: int, payload: LeaveStatusUpdate, db: Session = Depends(get_db)):
    allowed = {"APPROVED", "REJECTED", "REQ_INFO", "PENDING"}
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status")

    try:
        updated = update_status(
            db,
            request_id,
            payload.status,
            approved_by=get_current_manager_id(),
            rejection_reason=payload.rejection_reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not updated:
        raise HTTPException(status_code=404, detail="Leave request not found")

    return updated

@router.get("/types", response_model=list[LeaveTypeOut])
def list_leave_types(db: Session = Depends(get_db)):
    return get_leave_types(db)

@router.post("/types", response_model=LeaveTypeOut)
def add_leave_type(payload: LeaveTypeCreate, db: Session = Depends(get_db)):
    try:
        return create_leave_type(db, payload.name, payload.description)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@router.post("/upload")
def upload_leave_attachment(file: UploadFile = File(...)):
    allowed_types = ["image/jpeg", "image/png", "application/pdf"]

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, JPG, and PNG files are allowed"
        )

    filename = f"{uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"file_url": f"/uploads/medical_docs/{filename}"}

@router.get("/history/me", response_model=list[LeaveRequestOut])
def get_my_leave_history_api(
    search: str | None = None,
    leave_type_id: int | None = None,
    status: str | None = None,
    sort_by: str = "newest",
    db: Session = Depends(get_db),
):
    return get_my_leave_history(
        db=db,
        employee_id=get_current_employee_id(),
        search=search,
        leave_type_id=leave_type_id,
        status=status,
        sort_by=sort_by,
    )