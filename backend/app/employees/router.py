from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.leave.schemas import LeaveRequestCreate, LeaveRequestOut, LeaveStatusUpdate
from app.leave.service import create_leave, my_requests, pending_requests, update_status

router = APIRouter(prefix="/leave", tags=["Leave"])



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

    updated = update_status(
        db,
        request_id,
        payload.status,
        approved_by=get_current_manager_id(),
        rejection_reason=payload.rejection_reason,
    )

    if not updated:
        raise HTTPException(status_code=404, detail="Leave request not found")

    return updated