from sqlalchemy.orm import Session
from app.documents.models.request_model import DocumentRequest, RequestStatus


def create_document_request(db: Session, data):
    request = DocumentRequest(
        employee_id=data.employee_id,
        document_type=data.document_type,
        purpose=data.purpose,
        status=RequestStatus.PENDING
    )

    db.add(request)
    db.commit()
    db.refresh(request)

    return request


def get_employee_requests(db: Session, employee_id):
    return (
        db.query(DocumentRequest)
        .filter(DocumentRequest.employee_id == employee_id)
        .order_by(DocumentRequest.created_at.desc())
        .all()
    )