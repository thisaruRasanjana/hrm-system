from sqlalchemy.orm import Session
from app.documents.models.request_model import DocumentRequest, RequestStatus
from app.employees.models import Employee

def create_document_request(db: Session, data):
    request = DocumentRequest(
        employee_id=data.employee_id,
        document_type=data.document_type,
        reason=data.reason,
        status=RequestStatus.PENDING
    )

    db.add(request)
    db.commit()
    db.refresh(request)

    return request

def get_all_requests(db: Session):
    results = (
        db.query(DocumentRequest, Employee.first_name, Employee.last_name)
        .outerjoin(Employee, DocumentRequest.employee_id == Employee.id)
        .order_by(DocumentRequest.created_at.desc())
        .all()
    )
    
    requests = []
    for req, first_name, last_name in results:
        req_dict = {c.name: getattr(req, c.name) for c in req.__table__.columns}
        if first_name and last_name:
            req_dict["employee_name"] = f"{first_name} {last_name}"
        else:
            req_dict["employee_name"] = "Unknown Employee"
        requests.append(req_dict)
    
    return requests

def get_employee_requests(db: Session, employee_id):
    results = (
        db.query(DocumentRequest, Employee.first_name, Employee.last_name)
        .outerjoin(Employee, DocumentRequest.employee_id == Employee.id)
        .filter(DocumentRequest.employee_id == employee_id)
        .order_by(DocumentRequest.created_at.desc())
        .all()
    )
    
    requests = []
    for req, first_name, last_name in results:
        req_dict = {c.name: getattr(req, c.name) for c in req.__table__.columns}
        if first_name and last_name:
            req_dict["employee_name"] = f"{first_name} {last_name}"
        else:
            req_dict["employee_name"] = "Unknown Employee"
        requests.append(req_dict)
    
    return requests