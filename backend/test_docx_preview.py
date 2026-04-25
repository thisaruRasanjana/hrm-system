import sys
from sqlalchemy.orm import Session
from app.database.database import SessionLocal
from app.documents.models.request_model import DocumentRequest
from app.documents.models.template_model import DocumentTemplate
from app.documents.services.document_generator import generate_document_from_request

def test_preview():
    db: Session = SessionLocal()
    try:
        req = db.query(DocumentRequest).first()
        if not req:
            print("No DocumentRequest found.")
            return

        template = db.query(DocumentTemplate).filter(DocumentTemplate.template_type == "DOCX").first()
        if not template:
            print("No DOCX template found.")
            return

        print(f"Testing with Request ID: {req.id}")
        print(f"Testing with Template ID: {template.id}")
        
        _, html_content = generate_document_from_request(db, req.id, template.id, preview=True)
        with open("preview_out.html", "w", encoding="utf-8") as f:
            f.write(html_content)
        print("Done")

    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_preview()
