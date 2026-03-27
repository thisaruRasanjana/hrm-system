import os
import uuid
import re
from datetime import datetime
from sqlalchemy.orm import Session

from app.documents.models.request_model import DocumentRequest, RequestStatus
from app.documents.models.template_model import DocumentTemplate
from app.employees.models import Employee

GENERATED_DOCS_DIR = os.path.join("uploads", "generated_documents")
os.makedirs(GENERATED_DOCS_DIR, exist_ok=True)


# ─────────────────────────────────────────────
# Shared: build context dict from request + employee
# ─────────────────────────────────────────────
def _build_context(employee: Employee, doc_request: DocumentRequest) -> dict:
    return {
        "employee_name": f"{employee.first_name} {employee.last_name}",
        "employee_id": str(employee.id),
        "designation": getattr(employee, "designation", "Employee"),
        "department": getattr(employee, "department", "Relevant Department"),
        "date": datetime.now().strftime("%B %d, %Y"),
        "purpose": doc_request.purpose,
        "document_type": doc_request.document_type,
    }


def _build_external_context(doc_request: DocumentRequest) -> dict:
    """Build a context dict for external email requests with no linked employee."""
    # Try to derive a name from the requester email address (e.g. john.doe@org.com → John Doe)
    email_addr = doc_request.requester_email or "External Requester"
    name_part = email_addr.split("@")[0].replace(".", " ").replace("_", " ").title()
    return {
        "employee_name": name_part,
        "employee_id": "N/A",
        "designation": "N/A",
        "department": "N/A",
        "date": datetime.now().strftime("%B %d, %Y"),
        "purpose": doc_request.purpose,
        "document_type": doc_request.document_type,
        "requester_email": email_addr,
    }


def _replace_placeholders(text: str, context: dict) -> str:
    """Replace {{variable}} style placeholders with context values."""
    for key, value in context.items():
        text = text.replace(f"{{{{{key}}}}}", str(value))
    return text


# ─────────────────────────────────────────────
# HTML Generation (Jinja2)
# ─────────────────────────────────────────────
def _generate_from_html(template: DocumentTemplate, context: dict, preview: bool):
    try:
        from jinja2 import Template as Jinja2Template
        jinja_template = Jinja2Template(template.content)
        rendered_html = jinja_template.render(**context)
    except Exception as e:
        raise ValueError(f"Failed to render HTML template: {e}")

    filename = f"{context['employee_name'].replace(' ', '_')}_{template.name.replace(' ', '_')}_{uuid.uuid4().hex[:6]}"
    html_path = os.path.join(GENERATED_DOCS_DIR, f"{filename}.html")

    wrapper = f"""<!DOCTYPE html>
<html>
  <head>
    <style>
      body {{ font-family: sans-serif; padding: 40px; line-height: 1.6; color: #333; }}
      h1, h2, h3 {{ color: #111; }}
    </style>
  </head>
  <body>{rendered_html}</body>
</html>"""

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(wrapper)

    if preview:
        return None, rendered_html

    # Try PDF conversion, fall back to HTML
    final_path = html_path
    try:
        from xhtml2pdf import pisa
        pdf_path = os.path.join(GENERATED_DOCS_DIR, f"{filename}.pdf")
        with open(pdf_path, "wb") as pdf_file:
            pisa_status = pisa.CreatePDF(wrapper, dest=pdf_file)
        if not pisa_status.err:
            if os.path.exists(html_path):
                os.remove(html_path)
            final_path = pdf_path
        else:
            print(f"Warning: xhtml2pdf encountered errors.")
    except Exception as e:
        print(f"Warning: PDF generation failed ({e}). Returning HTML instead.")

    return final_path, rendered_html


# ─────────────────────────────────────────────
# DOCX Generation (python-docx variable replacement)
# ─────────────────────────────────────────────
def _replace_in_paragraph(paragraph, context: dict):
    """Replace placeholders in a paragraph while preserving runs/formatting."""
    # First check if the full paragraph text contains any placeholder
    full_text = "".join(run.text for run in paragraph.runs)
    if "{{" not in full_text:
        return

    # Rebuild runs: merge all run texts, replace, then put back into first run
    replaced = _replace_placeholders(full_text, context)
    for i, run in enumerate(paragraph.runs):
        run.text = replaced if i == 0 else ""


def _generate_from_docx(template: DocumentTemplate, context: dict, preview: bool):
    if not template.file_path or not os.path.exists(template.file_path):
        raise ValueError("DOCX template file not found on disk.")

    try:
        from docx import Document
    except ImportError:
        raise ValueError("python-docx is not installed. Run: pip install python-docx")

    doc = Document(template.file_path)

    # Replace in all body paragraphs
    for para in doc.paragraphs:
        _replace_in_paragraph(para, context)

    # Replace in all tables
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    _replace_in_paragraph(para, context)

    # Replace in headers and footers
    for section in doc.sections:
        for para in section.header.paragraphs:
            _replace_in_paragraph(para, context)
        for para in section.footer.paragraphs:
            _replace_in_paragraph(para, context)

    filename = f"{context['employee_name'].replace(' ', '_')}_{template.name.replace(' ', '_')}_{uuid.uuid4().hex[:6]}.docx"
    output_path = os.path.join(GENERATED_DOCS_DIR, filename)
    doc.save(output_path)

    if preview:
        try:
            import mammoth
            with open(output_path, "rb") as docx_file:
                result = mammoth.convert_to_html(docx_file)
                html_preview = result.value
                
            html_preview = f"""
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
                {html_preview}
            </div>
            """
        except Exception as e:
            html_preview = f"<p>Error generating DOCX preview: {e}</p>"

        if os.path.exists(output_path):
            os.remove(output_path)
            
        return None, html_preview

    # Generate PDF from DOCX using mammoth + xhtml2pdf as requested
    final_output_path = output_path
    try:
        import mammoth
        from xhtml2pdf import pisa
        
        pdf_filename = f"{filename.replace('.docx', '')}.pdf"
        pdf_path = os.path.join(GENERATED_DOCS_DIR, pdf_filename)
        
        with open(output_path, "rb") as docx_file:
            result = mammoth.convert_to_html(docx_file)
            raw_html = result.value
            
        pdf_wrapper = f"""<!DOCTYPE html>
<html>
  <head>
    <style>
      body {{ font-family: sans-serif; padding: 40px; line-height: 1.6; color: #333; }}
      table {{ border-collapse: collapse; width: 100%; }}
      th, td {{ border: 1px solid #ddd; padding: 8px; }}
    </style>
  </head>
  <body>{raw_html}</body>
</html>"""

        with open(pdf_path, "wb") as pdf_file:
            pisa_status = pisa.CreatePDF(pdf_wrapper, dest=pdf_file)
            
        if not pisa_status.err:
            if os.path.exists(output_path):
                os.remove(output_path)
            final_output_path = pdf_path
    except Exception as e:
        print(f"Warning: DOCX to PDF generation failed ({e}). Returning DOCX instead.")

    return final_output_path, None


# ─────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────
def generate_document_from_request(
    db: Session,
    request_id: uuid.UUID,
    template_id: int,
    preview: bool = False
):
    # 1. Fetch all required records
    doc_request = db.query(DocumentRequest).filter(DocumentRequest.id == request_id).first()
    if not doc_request:
        raise ValueError("Document request not found")

    employee = None
    if doc_request.employee_id:
        employee = db.query(Employee).filter(Employee.id == doc_request.employee_id).first()
        if not employee:
            raise ValueError("Linked employee not found in the system")

    template = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    if not template:
        raise ValueError("Template not found")

    # 2. Build shared context — use external fallback if no employee is linked
    if doc_request.employee_id and employee:
        context = _build_context(employee, doc_request)
    else:
        # External request: generate using the requester's email info as context
        context = _build_external_context(doc_request)

    # 3. Route to the correct generator
    template_type = (template.template_type or "").upper()

    if template_type == "HTML":
        saved_path, html_content = _generate_from_html(template, context, preview)
    elif template_type == "DOCX":
        saved_path, html_content = _generate_from_docx(template, context, preview)
    elif template_type == "PDF":
        raise ValueError(
            "PDF templates do not support variable filling. "
            "Please use an HTML or DOCX template for auto-generation."
        )
    else:
        raise ValueError(f"Unsupported template type: '{template.template_type}'")

    # 4. If preview-only, return without saving to DB
    if preview:
        return doc_request, html_content

    # 5. Save path and mark COMPLETED
    final_path = saved_path.replace("\\", "/") if saved_path else None
    doc_request.status = RequestStatus.COMPLETED
    doc_request.generated_document_path = final_path

    db.commit()
    db.refresh(doc_request)

    # 6. If this is an EXTERNAL request, automatically email the document to the requester
    if getattr(doc_request, "source", "INTERNAL") == "EXTERNAL" and doc_request.requester_email and final_path:
        try:
            from app.documents.services.email_service import send_document_to_requester
            # Build the absolute path for the file
            abs_path = os.path.join(os.getcwd(), final_path.replace("/", os.sep))
            send_document_to_requester(
                to_email=doc_request.requester_email,
                document_path=abs_path,
                document_type=doc_request.document_type
            )
        except Exception as e:
            print(f"[Document Generator] Warning: Could not email document to requester: {e}")

    return doc_request, html_content
