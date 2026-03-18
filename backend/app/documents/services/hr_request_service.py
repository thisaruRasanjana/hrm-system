from sqlalchemy.orm import Session
from uuid import UUID
from fastapi import HTTPException

from app.documents.models.request_model import DocumentRequest, RequestStatus
from app.employees.models import Employee

def get_all_hr_requests(db: Session, status: str = None):
    query = (
        db.query(DocumentRequest, Employee)
        .outerjoin(Employee, Employee.id == DocumentRequest.employee_id)
        .order_by(DocumentRequest.created_at.desc())
    )
    
    if status:
        try:
            status_enum = RequestStatus[status]
            query = query.filter(DocumentRequest.status == status_enum)
        except KeyError:
            pass

    requests = query.all()
    
    result = []
    for req, emp in requests:
        employee_name = f"{emp.first_name} {emp.last_name}" if emp else "Unknown Employee"
        result.append({
            "id": req.id,
            "employee_id": req.employee_id,
            "employee_name": employee_name,
            "document_type": req.document_type,
            "purpose": req.purpose,
            "status": req.status,
            "rejection_reason": req.rejection_reason,
            "generated_document_path": req.generated_document_path,
            "created_at": req.created_at
        })
        
    return result

def update_request_status(db: Session, request_id: UUID, status: RequestStatus, rejection_reason: str = None):
    request = db.query(DocumentRequest).filter(DocumentRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if status == RequestStatus.REJECTED and not rejection_reason:
        raise HTTPException(status_code=400, detail="Rejection reason is required")
        
    request.status = status
    if status == RequestStatus.REJECTED:
        request.rejection_reason = rejection_reason
        
    db.commit()
    db.refresh(request)
    
    return request
