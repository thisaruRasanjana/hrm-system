from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import os
import shutil
from uuid import uuid4
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_user_permissions, require_permission
from app.auth.models import User
from app.employees.models import Employee
from app.database.database import get_db

from app.leave.schemas import (
    LeaveRequestCreate,
    LeaveRequestOut,
    LeaveStatusUpdate,
    LeaveTypeCreate,
    LeaveTypeOut,
    LeaveBalanceOut,
    EntitlementItem,
    EntitlementMatrixOut,
    AssignLeaveRequestCreate,
    ApproveLeaveRequest,
    RejectLeaveRequest,
    RequestInfoLeaveRequest,
    ResubmitLeaveRequest,
    EmployeeEntitlementItem,
    EmployeeEntitlementOut,
    MedicalConversionCreate,
    MedicalConversionOut,
    MedicalConversionReview,
)

from app.leave.service import (
    create_leave,
    get_leave_balances,
    get_leave_entitlements,
    set_leave_entitlements,
    get_employee_leave_entitlements,
    set_employee_leave_entitlements,
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
    create_medical_conversion,
    list_medical_conversions,
    get_pending_medical_conversions,
    approve_medical_conversion,
    reject_medical_conversion,
)

router = APIRouter(prefix="/leave", tags=["Leave"])

UPLOAD_DIR = "uploads/medical_docs"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def leave_actor(*permissions: str):
    """
    Dependency factory bridging JWT auth to the leave service layer.

    Enforces that the caller holds AT LEAST ONE of the given leave
    permissions, then returns the {id, role} dict the service expects:
      - id   → Employee.id mapped from the JWT user
      - role → "hr" if the caller can approve leave (sees all requests),
               otherwise "employee" (sees own requests only)

    Reviewers without an employee profile (e.g. superadmin) get id=0 so
    ownership filters match nothing but review endpoints still work.
    """
    def _dep(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        perms = get_user_permissions(current_user, db)
        if permissions and not any(p in perms for p in permissions):
            raise HTTPException(
                status_code=403,
                detail=f"Permission required: one of {', '.join(permissions)}",
            )
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        is_reviewer = "leave:approve" in perms
        if emp is None:
            if not is_reviewer:
                raise HTTPException(
                    status_code=404,
                    detail="No employee profile linked to your account. Contact HR.",
                )
            emp_id = 0
        else:
            emp_id = emp.id
        # can_assign = holds leave:assign → HR / Super Admin (NOT Manager). Used to
        # gate approval of assigned leaves to HR/Admin only.
        return {
            "id": emp_id,
            "role": "hr" if is_reviewer else "employee",
            "can_assign": "leave:assign" in perms,
        }
    return _dep


def _guard_assigned_request(req, current_user: dict) -> None:
    """
    Extra gate for leaves created via /leave/assign (assigned_by is set):
    only HR/Admin (leave:assign holders) may action them, and never the person
    who assigned it (separation of duties). Managers are excluded.
    Normal self-requests (assigned_by is None) are unaffected.
    """
    if getattr(req, "assigned_by", None) is None:
        return
    if not current_user.get("can_assign"):
        raise HTTPException(
            status_code=403,
            detail="Assigned leaves can only be approved by HR or Admin",
        )
    if req.assigned_by == current_user["id"]:
        raise HTTPException(
            status_code=403,
            detail="You cannot approve a leave you assigned",
        )


# -----------------------------
# CREATE LEAVE
# -----------------------------
@router.post("/requests", response_model=LeaveRequestOut)
def submit_leave(
    payload: LeaveRequestCreate,
    current_user: dict = Depends(leave_actor("leave:request")),
    db: Session = Depends(get_db),
):
    try:
        return create_leave(db, current_user["id"], payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/assign", response_model=LeaveRequestOut)
def assign_leave(
    payload: AssignLeaveRequestCreate,
    current_user: dict = Depends(leave_actor("leave:assign")),
    db: Session = Depends(get_db),
):
    try:
        # HR assigns on the employee's behalf → creates a PENDING request that
        # must still be approved by HR/Admin (never the assigner, never a Manager).
        return create_leave(db, payload.employee_id, payload,
                            assigned_by=current_user["id"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# -----------------------------
# MY LEAVE BALANCES
# -----------------------------
@router.get("/balance/me", response_model=list[LeaveBalanceOut])
def get_my_leave_balances(
    current_user: dict = Depends(leave_actor("leave:request", "leave:view_history")),
    db: Session = Depends(get_db),
):
    return get_leave_balances(db, current_user["id"])


@router.get("/balance/{employee_id}", response_model=list[LeaveBalanceOut])
def get_employee_leave_balances(
    employee_id: int,
    current_user: dict = Depends(leave_actor("leave:approve", "leave:report")),
    db: Session = Depends(get_db),
):
    """Leave balances for a specific employee — used by reviewers in the approval panel."""
    return get_leave_balances(db, employee_id)


# -----------------------------
# UPDATE OWN PENDING LEAVE
# -----------------------------
@router.put("/requests/{request_id}", response_model=LeaveRequestOut)
def update_leave(
    request_id: int,
    payload: LeaveRequestCreate,
    current_user: dict = Depends(leave_actor("leave:edit_pending")),
    db: Session = Depends(get_db),
):
    try:
        return update_leave_request(db, request_id, current_user["id"], payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# -----------------------------
# DELETE OWN PENDING LEAVE
# -----------------------------
@router.delete("/requests/{request_id}")
def delete_leave(
    request_id: int,
    current_user: dict = Depends(leave_actor("leave:edit_pending")),
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
    current_user: dict = Depends(leave_actor("leave:view_history", "leave:request")),
    db: Session = Depends(get_db),
):
    return my_requests(db, current_user["id"])


# -----------------------------
# PENDING REQUESTS (approvers)
# -----------------------------
@router.get("/requests/pending", response_model=list[LeaveRequestOut])
def get_pending(
    current_user: dict = Depends(leave_actor("leave:approve")),
    db: Session = Depends(get_db),
):
    return get_pending_requests(db, current_user)


# -----------------------------
# GET SINGLE REQUEST
# -----------------------------
@router.get("/requests/{request_id}", response_model=LeaveRequestOut)
def get_leave_request_details(
    request_id: int,
    current_user: dict = Depends(leave_actor("leave:view_history", "leave:approve")),
    db: Session = Depends(get_db),
):
    req = get_leave_request_by_id(db, request_id)

    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")

    # Non-reviewers can only see their own requests
    if current_user["role"] == "employee" and req.employee_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    return req


# -----------------------------
# APPROVE REQUEST
# -----------------------------
@router.patch("/requests/{request_id}/approve", response_model=LeaveRequestOut)
def approve_request(
    request_id: int,
    payload: ApproveLeaveRequest,
    current_user: dict = Depends(leave_actor("leave:approve")),
    db: Session = Depends(get_db),
):
    req = get_leave_request_by_id(db, request_id)

    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if req.employee_id == current_user["id"]:
        raise HTTPException(status_code=403, detail="Cannot approve your own request")

    _guard_assigned_request(req, current_user)

    try:
        return approve_leave_request(
            db,
            request_id,
            approved_by=current_user["id"],
            manager_comment=payload.manager_comment,
            approved_leave_type_id=payload.approved_leave_type_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# -----------------------------
# REJECT REQUEST
# -----------------------------
@router.patch("/requests/{request_id}/reject", response_model=LeaveRequestOut)
def reject_request(
    request_id: int,
    payload: RejectLeaveRequest,
    current_user: dict = Depends(leave_actor("leave:reject")),
    db: Session = Depends(get_db),
):
    req = get_leave_request_by_id(db, request_id)

    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if req.employee_id == current_user["id"]:
        raise HTTPException(status_code=403, detail="Cannot reject your own request")

    _guard_assigned_request(req, current_user)

    return reject_leave_request(
        db,
        request_id,
        approved_by=current_user["id"],
        rejection_reason=payload.rejection_reason,
    )


# -----------------------------
# REQUEST INFO
# -----------------------------
@router.patch("/requests/{request_id}/request-info", response_model=LeaveRequestOut)
def request_info(
    request_id: int,
    payload: RequestInfoLeaveRequest,
    current_user: dict = Depends(leave_actor("leave:approve")),
    db: Session = Depends(get_db),
):
    req = get_leave_request_by_id(db, request_id)

    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if req.employee_id == current_user["id"]:
        raise HTTPException(status_code=403, detail="Cannot request info for own request")

    _guard_assigned_request(req, current_user)

    return request_info_leave_request(
        db,
        request_id,
        approved_by=current_user["id"],
        manager_comment=payload.manager_comment,
    )


# -----------------------------
# RESUBMIT OWN REQUEST
# -----------------------------
@router.patch("/requests/{request_id}/resubmit", response_model=LeaveRequestOut)
def resubmit_request(
    request_id: int,
    payload: ResubmitLeaveRequest,
    current_user: dict = Depends(leave_actor("leave:request")),
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
# UPDATE STATUS (approvers)
# -----------------------------
@router.patch("/requests/{request_id}/status", response_model=LeaveRequestOut)
def change_status(
    request_id: int,
    payload: LeaveStatusUpdate,
    current_user: dict = Depends(leave_actor("leave:approve")),
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

    _guard_assigned_request(req, current_user)

    return update_status(
        db,
        request_id,
        payload.status,
        approved_by=current_user["id"],
        rejection_reason=payload.rejection_reason,
    )


# -----------------------------
# PER-ROLE ENTITLEMENTS (HR / Super Admin)
# -----------------------------
@router.get("/entitlements", response_model=EntitlementMatrixOut)
def list_entitlements(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("leave:type_manage")),
):
    return get_leave_entitlements(db)


@router.put("/entitlements", response_model=EntitlementMatrixOut)
def update_entitlements(
    items: list[EntitlementItem],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("leave:type_manage")),
):
    try:
        return set_leave_entitlements(db, items)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/entitlements/employee/{employee_id}", response_model=EmployeeEntitlementOut)
def list_employee_entitlements(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("leave:type_manage")),
):
    try:
        return get_employee_leave_entitlements(db, employee_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.put("/entitlements/employee/{employee_id}", response_model=EmployeeEntitlementOut)
def update_employee_entitlements(
    employee_id: int,
    items: list[EmployeeEntitlementItem],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("leave:type_manage")),
):
    try:
        return set_employee_leave_entitlements(db, employee_id, items)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# -----------------------------
# LEAVE TYPES
# -----------------------------
@router.get("/types", response_model=list[LeaveTypeOut])
def list_leave_types(
    requestable: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_leave_types(db, requestable_only=requestable)


@router.post("/types", response_model=LeaveTypeOut)
def add_leave_type(
    payload: LeaveTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("leave:type_manage")),
):
    return create_leave_type(db, payload.name, payload.description)


# -----------------------------
# UPLOAD FILE
# -----------------------------
@router.post("/upload")
def upload_leave_attachment(
    file: UploadFile = File(...),
    current_user: dict = Depends(leave_actor("leave:request")),
):
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
    current_user: dict = Depends(leave_actor("leave:view_history")),
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


# -----------------------------
# MEDICAL CONVERSIONS
# -----------------------------
@router.post("/requests/{request_id}/medical-conversion", response_model=MedicalConversionOut)
def request_medical_conversion(
    request_id: int,
    payload: MedicalConversionCreate,
    current_user: dict = Depends(leave_actor("leave:request")),
    db: Session = Depends(get_db),
):
    try:
        return create_medical_conversion(db, current_user["id"], request_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/requests/{request_id}/medical-conversions", response_model=list[MedicalConversionOut])
def get_request_medical_conversions(
    request_id: int,
    current_user: dict = Depends(leave_actor("leave:request", "leave:approve")),
    db: Session = Depends(get_db),
):
    # Verify request existence and auth
    req = get_leave_request_by_id(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if current_user["role"] == "employee" and req.employee_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return list_medical_conversions(db, request_id)


@router.get("/medical-conversions/pending", response_model=list[MedicalConversionOut])
def get_pending_conversions(
    current_user: dict = Depends(leave_actor("leave:approve")),
    db: Session = Depends(get_db),
):
    return get_pending_medical_conversions(db, current_user)


@router.patch("/medical-conversions/{conversion_id}/approve", response_model=MedicalConversionOut)
def approve_conversion(
    conversion_id: int,
    payload: MedicalConversionReview,
    current_user: dict = Depends(leave_actor("leave:approve")),
    db: Session = Depends(get_db),
):
    try:
        return approve_medical_conversion(
            db,
            conversion_id,
            reviewer_id=current_user["id"],
            comment=payload.reviewer_comment,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/medical-conversions/{conversion_id}/reject", response_model=MedicalConversionOut)
def reject_conversion(
    conversion_id: int,
    payload: MedicalConversionReview,
    current_user: dict = Depends(leave_actor("leave:approve")),
    db: Session = Depends(get_db),
):
    try:
        return reject_medical_conversion(
            db,
            conversion_id,
            reviewer_id=current_user["id"],
            comment=payload.reviewer_comment,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
