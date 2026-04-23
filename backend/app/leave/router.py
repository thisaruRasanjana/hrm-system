from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import os
import shutil
from uuid import uuid4
from sqlalchemy.orm import Session

from app.core.rbac import require_roles, get_current_user
from app.database.database import get_db

from app.leave.schemas import (
    LeaveRequestCreate,
    LeaveRequestOut,
    LeaveStatusUpdate,
    LeaveTypeCreate,
    LeaveTypeOut,
    ApproveLeaveRequest,
    RejectLeaveRequest,
    RequestInfoLeaveRequest,
    ResubmitLeaveRequest,
)

from app.leave.service import (
    create_leave,
    my_requests,
    get_pending_requests,
    update_status,
    get_leave_types,
    create_leave_type,
    get_leave_history,
    get_leave_request_by_id,
    approve_leave_request,
    reject_leave_request,
    request_info_leave_request,
    resubmit_leave_request,
    delete_leave_request,
    update_leave_request,
)

router = APIRouter(prefix="/leave", tags=["Leave"])

UPLOAD_DIR = "uploads/medical_docs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# -----------------------------
# CREATE LEAVE (EMPLOYEE + HR)
# -----------------------------
@router.post("/requests", response_model=LeaveRequestOut)
def submit_leave(
    payload: LeaveRequestCreate,
    current_user: dict = Depends(require_roles(["employee", "hr"])),
    db: Session = Depends(get_db),
):
    return create_leave(db, current_user["id"], payload)


# -----------------------------
# UPDATE LEAVE (EMPLOYEE ONLY)
# -----------------------------
@router.put("/requests/{request_id}", response_model=LeaveRequestOut)
def update_leave(
    request_id: int,
    payload: LeaveRequestCreate,
    current_user: dict = Depends(require_roles(["employee", "hr"])),
    db: Session = Depends(get_db),
):
    try:
        return update_leave_request(db, request_id, current_user["id"], payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# -----------------------------
# DELETE LEAVE (EMPLOYEE ONLY)
# -----------------------------
@router.delete("/requests/{request_id}")
def delete_leave(
    request_id: int,
    current_user: dict = Depends(require_roles(["employee", "hr"])),
    db: Session = Depends(get_db),
):
    try:
        delete_leave_request(db, request_id, current_user["id"])
        return {"detail": "Leave request deleted"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# -----------------------------
# MY LEAVES
# -----------------------------
@router.get("/requests/me", response_model=list[LeaveRequestOut])
def get_my_leave(
    current_user: dict = Depends(require_roles(["employee", "hr"])),
    db: Session = Depends(get_db),
):
    return my_requests(db, current_user["id"])


# -----------------------------
# PENDING REQUESTS (HR ONLY)
# -----------------------------
@router.get("/requests/pending", response_model=list[LeaveRequestOut])
def get_pending(
    current_user: dict = Depends(require_roles(["hr"])),
    db: Session = Depends(get_db),
):
    return get_pending_requests(db, current_user)


# -----------------------------
# GET SINGLE REQUEST
# -----------------------------
@router.get("/requests/{request_id}", response_model=LeaveRequestOut)
def get_leave_request_details(
    request_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    req = get_leave_request_by_id(db, request_id)

    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")

    role = current_user["role"]

    # Employee can only see own requests
    if role == "employee":
        if req.employee_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")

    # HR can see everything → no restriction

    return req


# -----------------------------
# APPROVE REQUEST (HR ONLY)
# -----------------------------
@router.patch("/requests/{request_id}/approve", response_model=LeaveRequestOut)
def approve_request(
    request_id: int,
    payload: ApproveLeaveRequest,
    current_user: dict = Depends(require_roles(["hr"])),
    db: Session = Depends(get_db),
):
    req = get_leave_request_by_id(db, request_id)

    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if req.employee_id == current_user["id"]:
        raise HTTPException(status_code=403, detail="Cannot approve your own request")

    return approve_leave_request(
        db,
        request_id,
        approved_by=current_user["id"],
        manager_comment=payload.manager_comment,
    )


# -----------------------------
# REJECT REQUEST (HR ONLY)
# -----------------------------
@router.patch("/requests/{request_id}/reject", response_model=LeaveRequestOut)
def reject_request(
    request_id: int,
    payload: RejectLeaveRequest,
    current_user: dict = Depends(require_roles(["hr"])),
    db: Session = Depends(get_db),
):
    req = get_leave_request_by_id(db, request_id)

    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if req.employee_id == current_user["id"]:
        raise HTTPException(status_code=403, detail="Cannot reject your own request")

    return reject_leave_request(
        db,
        request_id,
        approved_by=current_user["id"],
        rejection_reason=payload.rejection_reason,
    )


# -----------------------------
# REQUEST INFO (HR ONLY)
# -----------------------------
@router.patch("/requests/{request_id}/request-info", response_model=LeaveRequestOut)
def request_info(
    request_id: int,
    payload: RequestInfoLeaveRequest,
    current_user: dict = Depends(require_roles(["hr"])),
    db: Session = Depends(get_db),
):
    req = get_leave_request_by_id(db, request_id)

    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if req.employee_id == current_user["id"]:
        raise HTTPException(status_code=403, detail="Cannot request info for own request")

    return request_info_leave_request(
        db,
        request_id,
        approved_by=current_user["id"],
        manager_comment=payload.manager_comment,
    )


# -----------------------------
# RESUBMIT REQUEST (EMPLOYEE ONLY)
# -----------------------------
@router.patch("/requests/{request_id}/resubmit", response_model=LeaveRequestOut)
def resubmit_request(
    request_id: int,
    payload: ResubmitLeaveRequest,
    current_user: dict = Depends(require_roles(["employee", "hr"])),
    db: Session = Depends(get_db),
):
    try:
        return resubmit_leave_request(
            db=db,
            request_id=request_id,
            employee_id=current_user["id"],
            attachment_urls=payload.attachment_urls,
            reason=payload.reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))



# -----------------------------
# UPDATE STATUS (HR ONLY)
# -----------------------------
@router.patch("/requests/{request_id}/status", response_model=LeaveRequestOut)
def change_status(
    request_id: int,
    payload: LeaveStatusUpdate,
    current_user: dict = Depends(require_roles(["hr"])),
    db: Session = Depends(get_db),
):
    allowed = {"APPROVED", "REJECTED", "REQ_INFO", "PENDING"}

    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status")

    req = get_leave_request_by_id(db, request_id)

    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if req.employee_id == current_user["id"]:
        raise HTTPException(status_code=403, detail="Cannot change own request")

    return update_status(
        db,
        request_id,
        payload.status,
        approved_by=current_user["id"],
        rejection_reason=payload.rejection_reason,
    )


# -----------------------------
# LEAVE TYPES
# -----------------------------
@router.get("/types", response_model=list[LeaveTypeOut])
def list_leave_types(db: Session = Depends(get_db)):
    return get_leave_types(db)


@router.post("/types", response_model=LeaveTypeOut)
def add_leave_type(payload: LeaveTypeCreate, db: Session = Depends(get_db)):
    return create_leave_type(db, payload.name, payload.description)


# -----------------------------
# UPLOAD FILE
# -----------------------------
@router.post("/upload")
def upload_leave_attachment(file: UploadFile = File(...)):
    allowed_types = ["image/jpeg", "image/png", "application/pdf"]

    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type")

    filename = f"{uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"file_url": f"/uploads/medical_docs/{filename}"}


# -----------------------------
# LEAVE HISTORY
# -----------------------------
@router.get("/history/me", response_model=list[LeaveRequestOut])
def get_my_leave_history_api(
    current_user: dict = Depends(require_roles(["employee", "hr"])),
    search: str | None = None,
    leave_type_id: int | None = None,
    status: str | None = None,
    sort_by: str = "newest",
    db: Session = Depends(get_db),
):
    return get_leave_history(
        db=db,
        user=current_user,
        search=search,
        leave_type_id=leave_type_id,
        status=status,
        sort_by=sort_by,
    )