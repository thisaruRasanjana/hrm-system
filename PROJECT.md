# HRM System — Project Documentation

## Overview

A full-stack **Human Resource Management (HRM) System** built as an academic project. The system focuses on **document lifecycle management** for HR departments and employees — covering document uploads, approval workflows, template-based document generation, email-driven requests, and role-based access control.

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | FastAPI 0.128.0 |
| Language | Python 3.x |
| Database | PostgreSQL (via psycopg2-binary 2.9.11) |
| ORM | SQLAlchemy 2.0.45 |
| Validation | Pydantic 2.12.5 |
| Server | Uvicorn 0.40.0 |
| Document Processing | Mammoth, xhtml2pdf, python-docx |
| Template Engine | Jinja2 |
| Email | Python IMAP/SMTP (Gmail) |
| Config | python-dotenv 1.2.1 |

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.1 (App Router) |
| Language | TypeScript 5 |
| UI Library | React 19.2.3 |
| Styling | Tailwind CSS 4.2.4 |
| Icons | Lucide React |
| Rich Text Editor | TipTap 3.20.4 |
| Animation | Framer Motion 12.38.0 |

---

## Project Structure

```
hrm-system/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI app entry point, lifespan, CORS
│   │   ├── core/
│   │   │   ├── config.py              # Pydantic BaseSettings
│   │   │   └── database.py            # SQLAlchemy engine & session
│   │   ├── employees/
│   │   │   ├── models.py              # Employee, Role, Permission ORM models
│   │   │   ├── schemas.py             # Pydantic request/response schemas
│   │   │   ├── router.py              # CRUD endpoints for employees
│   │   │   └── service.py             # Business logic
│   │   ├── auth/
│   │   │   ├── models.py              # Role/Permission models & seed data
│   │   │   ├── schemas.py             # Auth schemas
│   │   │   └── router.py             # Role & permission management endpoints
│   │   └── documents/
│   │       ├── models.py              # All document-related ORM models
│   │       ├── schemas.py             # Document schemas
│   │       ├── email_poller.py        # Background IMAP email polling task
│   │       └── routers/
│   │           ├── router.py          # Employee document upload/download
│   │           ├── hr_router.py       # HR request management & generation
│   │           ├── approval_router.py # Document approval queue
│   │           ├── template_router.py # Template CRUD & preview
│   │           └── document_types_router.py  # Document type catalogue
│   ├── uploads/
│   │   ├── documents/                 # Employee uploaded files
│   │   ├── templates/                 # Template files (DOCX, PDF)
│   │   └── generated_documents/       # Output of document generation
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── documents/             # HR document management pages
│   │   │   │   ├── page.tsx           # Main HR dashboard
│   │   │   │   ├── request/           # HR request management
│   │   │   │   ├── approval/          # HR approval queue
│   │   │   │   ├── templates_management/  # Template CRUD UI
│   │   │   │   └── document_types/    # Document type management
│   │   │   └── employee/
│   │   │       └── documents/         # Employee document pages
│   │   │           ├── page.tsx       # Employee upload dashboard
│   │   │           └── request/       # Employee request form
│   │   └── components/
│   │       ├── Navbar.tsx
│   │       ├── SidebarHR.tsx
│   │       ├── SidebarEmployee.tsx
│   │       ├── DocumentTabsHR.tsx
│   │       ├── DocumentTabsEmployee.tsx
│   │       ├── AuthGuard.tsx
│   │       ├── DocumentItem.tsx
│   │       ├── DocumentSection.tsx
│   │       ├── DocumentProgress.tsx
│   │       ├── DocumentReviewModal.tsx
│   │       ├── GenerateDocumentModal.tsx
│   │       ├── RejectRequestModal.tsx
│   │       ├── TemplateAddModal.tsx
│   │       ├── TemplateEditModal.tsx
│   │       ├── TemplatePreviewModal.tsx
│   │       ├── RichTextEditor.tsx
│   │       ├── statusBadge.tsx
│   │       └── ConfirmModal.tsx
│   └── package.json
└── README.md
```

---

## Core Modules

### 1. Employee Management

Full CRUD for employee records.

**Fields managed:**
- Basic: name, email, phone, address
- Organizational: department, designation, joined date, status (Active/Inactive)
- Personal: date of birth, gender, marital status, nationality
- Emergency contact: name, phone, relationship
- Professional: skills, qualifications
- Financial: bank name, account number, branch
- Role assignment (RBAC)

---

### 2. Authentication & Role-Based Access Control (RBAC)

Header-based authentication using `X-Employee-ID`. No JWT tokens are used on this branch.

**Built-in system roles:**

| Role | Key Permissions |
|---|---|
| Admin | All permissions |
| HR Manager | Full document management (upload, view, generate, approve) |
| Manager | Employee view/edit, document view, leave approval, reports |
| Employee | Document view/upload, leave view |

**Granular permissions defined:**
- `employee:view`, `employee:create`, `employee:edit`, `employee:delete`
- `document:view`, `document:upload`, `document:approve`, `document:generate`
- `leave:view`, `leave:approve`
- `recruitment:view`, `recruitment:manage`
- `report:view`

Custom roles can be created with any combination of permissions via the API.

---

### 3. Document Management System

The central feature of this project. Consists of five sub-modules:

#### 3a. Employee Document Upload & Approval

Employees upload compliance documents (e.g. NIC, certificates). HR reviews and approves or rejects them.

**Workflow:**
```
Employee uploads → UPLOADED → HR reviews → PENDING_REVIEW → APPROVED or REJECTED
```

- Supports PDF, JPEG, PNG (max 10 MB)
- UUID-based document IDs (non-sequential, secure for download URLs)
- Mandatory document tracking with progress indicator
- Rejection includes a reason visible to the employee
- Full audit log of all status changes (immutable)

#### 3b. Document Requests

Employees or external parties request documents (service letters, payslips, visa letters, etc.).

**Two request sources:**
- **Internal**: Submitted via the employee portal
- **External**: Parsed automatically from inbound emails (Gmail IMAP)

**Workflow:**
```
PENDING → IN_PROGRESS → APPROVED → COMPLETED
                               └──→ REJECTED
```

HR can link external email requests to an existing employee record.

#### 3c. Document Template Management

HR manages reusable document templates.

- **Template types supported**: HTML (inline), DOCX (file upload), PDF (file upload)
- Rich text editor (TipTap) for HTML templates
- DOCX templates render a live HTML preview via Mammoth
- Templates are categorized and versioned
- Variables in templates (e.g. `{{ employee_name }}`, `{{ department }}`, `{{ date }}`) are filled at generation time

#### 3d. Document Generation

HR generates documents from templates for approved requests.

**Generation pipeline:**
1. Select a template for a request
2. System resolves context variables (employee name, department, date, etc.)
3. For HTML templates: Jinja2 renders → xhtml2pdf converts to PDF
4. For DOCX templates: variable placeholders are replaced → DOCX output
5. Generated file is stored and can be sent to the requester by email

Custom letters can also be generated from plain text (without a template).

#### 3e. Document Types Catalogue

HR maintains a master list of recognized document types (e.g. "NIC Copy", "Degree Certificate").

- Each type has a mandatory flag — mandatory types appear in the employee upload checklist
- Soft-delete via `is_active` flag
- UUID primary keys

---

### 4. Email Integration

A background asyncio task polls Gmail every 60 seconds via IMAP.

**Inbound flow:**
1. New emails in the inbox are scanned
2. Keyword matching classifies the document type requested
3. An external `DocumentRequest` record is created automatically
4. HR is notified; they can link the request to an employee and generate the document
5. Generated document is sent back to the requester via SMTP

---

### 5. Audit & Compliance

Every document status change is recorded in an immutable audit log:

- `document_audit_logs` table stores: request ID, changed by (employee ID), old status, new status, note, timestamp
- Logs cannot be deleted or updated

---

## Database Schema

```
employees
  id (PK, Integer)
  employee_id (unique string)
  email (unique)
  first_name, last_name, phone, address
  department, designation, joined_date
  status (Active/Inactive)
  date_of_birth, gender, marital_status, nationality
  emergency_contact_name/phone/relation
  skills, qualifications
  bank_name, bank_account_no, bank_branch
  role_id (FK → roles)

roles
  id (PK)
  name (unique), description, is_system

permissions
  id (PK)
  name (unique), description

role_permissions  [junction]
  role_id (FK), permission_id (FK)

employee_documents
  id (PK, UUID)
  employee_id (FK), document_type
  file_name, file_path
  status (UPLOADED/PENDING_REVIEW/APPROVED/REJECTED)
  is_mandatory
  uploaded_at, reviewed_by, reviewed_at, rejection_reason

document_requests
  id (PK, UUID)
  employee_id (FK, nullable for external)
  source (INTERNAL/EXTERNAL)
  requester_email, document_type, reason
  status (PENDING/IN_PROGRESS/APPROVED/COMPLETED/REJECTED)
  created_at, rejection_reason, generated_document_path

document_templates
  id (PK, Integer)
  name, category
  template_type (HTML/DOCX/PDF)
  content (HTML body, nullable)
  file_path (for DOCX/PDF, nullable)
  created_at, updated_at

document_types
  id (PK, UUID)
  name (unique), description
  is_mandatory, is_active
  created_at

document_audit_logs
  id (PK, UUID)
  request_id (FK → document_requests)
  changed_by_employee_id
  old_status, new_status, note
  changed_at
```

---

## API Reference

### Employees

| Method | Path | Description |
|---|---|---|
| GET | `/employees/` | List all employees |
| GET | `/employees/{id}` | Get single employee |
| POST | `/employees/` | Create employee |
| PUT | `/employees/{id}` | Update employee |
| DELETE | `/employees/{id}` | Delete employee |

### Auth / RBAC

| Method | Path | Description |
|---|---|---|
| GET | `/auth/roles` | List roles |
| GET | `/auth/permissions` | List permissions |
| POST | `/auth/roles` | Create custom role |
| PUT | `/auth/roles/{id}` | Update role permissions |
| POST | `/auth/assign` | Assign role to employee |

### Employee Documents

| Method | Path | Description |
|---|---|---|
| POST | `/documents/upload` | Upload a document |
| GET | `/documents/my-documents` | Get employee's documents |
| GET | `/documents/download/{id}` | Download a document |

### Document Requests

| Method | Path | Description |
|---|---|---|
| POST | `/document-requests/` | Submit a new request |
| GET | `/document-requests/` | List all requests |
| GET | `/document-requests/{employee_id}` | Get employee's requests |

### HR Request Management

| Method | Path | Description |
|---|---|---|
| GET | `/hr-document-requests/` | List all HR requests (filterable by status) |
| POST | `/hr-document-requests/{id}/generate` | Generate document from template |
| PATCH | `/hr-document-requests/{id}/status` | Update request status |
| POST | `/hr-document-requests/{id}/assign-employee` | Link employee to external request |
| POST | `/hr-document-requests/{id}/custom-letter` | Generate plain-text custom letter |

### Document Approval

| Method | Path | Description |
|---|---|---|
| GET | `/documents/review/pending` | Get pending review queue |
| PATCH | `/documents/review/{id}/approve` | Approve a document |
| PATCH | `/documents/review/{id}/reject` | Reject a document with reason |

### Document Templates

| Method | Path | Description |
|---|---|---|
| POST | `/document-templates/` | Create template |
| GET | `/document-templates/` | List templates |
| GET | `/document-templates/{id}` | Get template |
| PUT | `/document-templates/{id}` | Update template |
| DELETE | `/document-templates/{id}` | Delete template |
| GET | `/document-templates/{id}/preview` | Preview DOCX as HTML |

### Document Types

| Method | Path | Description |
|---|---|---|
| POST | `/api/document-types/` | Create document type |
| GET | `/api/document-types/` | List all types (HR) |
| GET | `/api/document-types/active/` | List active types |
| PATCH | `/api/document-types/{id}` | Update type |
| DELETE | `/api/document-types/{id}` | Soft-delete type |

---

## Frontend Pages

| Route | Role | Description |
|---|---|---|
| `/documents/` | HR | Main HR document management dashboard |
| `/documents/request/` | HR | View and process document requests |
| `/documents/approval/` | HR | Pending document review queue |
| `/documents/templates_management/` | HR | Manage document templates |
| `/documents/document_types/` | HR | Manage document type catalogue |
| `/employee/documents/` | Employee | Upload documents, track status |
| `/employee/documents/request/` | Employee | Submit a document request |

---

## Setup & Running

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL running on `localhost:5432`
- A Gmail account with IMAP enabled (for email integration)

### Backend

```bash
cd backend
pip install -r requirements.txt

# Create .env file with:
# DATABASE_URL=postgresql://user:password@localhost:5432/hrm_db
# EMAIL_USER=your@gmail.com
# EMAIL_PASSWORD=your_app_password

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

### Database

Tables are created automatically on startup via SQLAlchemy `create_all()`. No manual migrations needed for initial setup.

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| UUID PKs for documents | Prevents sequential ID enumeration in download URLs |
| Header-based auth (`X-Employee-ID`) | Simplified auth for academic scope; easily swappable for JWT |
| Background asyncio task for email | Non-blocking; runs independently of request lifecycle |
| Jinja2 + xhtml2pdf pipeline | Enables full HTML/CSS styled PDF output without external services |
| Mammoth for DOCX preview | Converts DOCX to clean HTML in-browser without Office dependency |
| Immutable audit logs | Compliance requirement — status changes must be traceable |
| Soft-delete on document types | Preserves historical references while hiding obsolete types |
| TipTap rich text editor | Headless, extensible; outputs clean HTML compatible with the PDF pipeline |

---

## Branch: `sachintha/documents`

This branch implements the complete **Document Management System** module on top of the base employee/auth infrastructure. Key commits on this branch:

- `f997f7c` — HTML template for salary confirmation letter preview
- `7424ad7` — `DocumentTabsHR` component for HR page navigation
- `234f0f4` — Request management dashboard for HR to review and process requests
- `b039cdc` — Document review and approval system (UI + backend)
- `c73b8e8` — Document template management system (HTML + file-based)

---

## Team

**Author:** Sachintha Dilshan (`sachintharcm@gmail.com`)  
**Repository:** `sachintha/documents` branch  
**Project Type:** Academic — Human Resource Management System
