import os
import uuid
import pdfkit
from jinja2 import Template
from sqlalchemy.orm import Session
from datetime import datetime

from app.documents.models.request_model import DocumentRequest, RequestStatus
from app.documents.models.template_model import DocumentTemplate
from app.employees.models import Employee

GENERATED_DOCS_DIR = os.path.join("uploads", "generated_documents")
os.makedirs(GENERATED_DOCS_DIR, exist_ok=True)

def generate_document_from_request(db: Session, request_id: uuid.UUID, template_id: int, preview: bool = False):
    # 1. Fetch Request, Employee, Template
    doc_request = db.query(DocumentRequest).filter(DocumentRequest.id == request_id).first()
    if not doc_request:
        raise ValueError("Document request not found")

    employee = db.query(Employee).filter(Employee.id == doc_request.employee_id).first()
    if not employee:
        raise ValueError("Employee not found")

    template = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    if not template:
        raise ValueError("Template not found")

    if template.template_type != "HTML":
        # Fallback for file templates - maybe just return the file path or copy it
        raise ValueError("Cannot auto-generate from non-HTML templates yet")

    # 2. Prepare Context Data
    # Assuming Employee model has fields like first_name, last_name, employee_id, etc.
    # Add any fallback variables needed
    context = {
        "employee_name": f"{employee.first_name} {employee.last_name}",
        "employee_id": str(employee.id),
        # You can add more fields based on your employee model like designation, department, salary
        # For now we use placeholders if they don't exist on Employee model directly.
        "designation": getattr(employee, 'designation', 'Employee'),
        "department": getattr(employee, 'department', 'Relevant Department'),
        "date": datetime.now().strftime("%B %d, %Y"),
        "purpose": doc_request.purpose
    }

    # 3. Render HTML with Jinja2
    jinja_template = Template(template.content)
    rendered_html = jinja_template.render(**context)

    # 4. Generate PDF (fallback to just saving HTML if pdfkit fails due to missing wkhtmltopdf)
    filename = f"{employee.first_name}_{employee.last_name}_{template.name.replace(' ', '_')}_{uuid.uuid4().hex[:6]}"
    pdf_path = os.path.join(GENERATED_DOCS_DIR, f"{filename}.pdf")
    html_path = os.path.join(GENERATED_DOCS_DIR, f"{filename}.html")

    # Always save the HTML as backup
    with open(html_path, "w", encoding="utf-8") as f:
        # Wrap it in standard HTML tags so it renders well
        wrapper = f"""
        <html>
            <head>
                <style>
                    body {{ font-family: sans-serif; padding: 40px; line-height: 1.6; color: #333; }}
                    h1, h2, h3 {{ color: #111; }}
                </style>
            </head>
            <body>{rendered_html}</body>
        </html>
        """
        f.write(wrapper)

    if preview:
        return doc_request, rendered_html

    final_saved_path = html_path

    try:
        # Try generating PDF
        pdfkit.from_string(wrapper, pdf_path)
        final_saved_path = pdf_path
        # Delete the backup html if pdf succeeds
        if os.path.exists(html_path):
            os.remove(html_path)
    except Exception as e:
        print(f"Warning: PDF generation failed ({e}). Returning generated HTML file instead.")
        final_saved_path = html_path

    # 5. Update Request Status & Path
    # Convert path to a URL format (unix slashes)
    final_saved_path = final_saved_path.replace("\\", "/")
    
    doc_request.status = RequestStatus.COMPLETED
    doc_request.generated_document_path = final_saved_path
    
    db.commit()
    db.refresh(doc_request)

    return doc_request, rendered_html
