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
        import pdfkit
        pdf_path = os.path.join(GENERATED_DOCS_DIR, f"{filename}.pdf")
        pdfkit.from_string(wrapper, pdf_path)
        if os.path.exists(html_path):
            os.remove(html_path)
        final_path = pdf_path
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
                
            # Wrap the converted HTML slightly so it looks decent
            html_preview = f"""
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px;">
                {html_preview}
            </div>
            """
        except Exception as e:
            html_preview = f"<p>Error generating DOCX preview: {e}</p>"

        # Clean up the generated file since it's only a preview
        if os.path.exists(output_path):
            os.remove(output_path)
            
        return None, html_preview

    return output_path, None


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

    employee = db.query(Employee).filter(Employee.id == doc_request.employee_id).first()
    if not employee:
        raise ValueError("Employee not found")

    template = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    if not template:
        raise ValueError("Template not found")

    # 2. Build shared context
    context = _build_context(employee, doc_request)

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

    return doc_request, html_content
