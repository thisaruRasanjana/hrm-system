# CoreHR: Enterprise Human Resource Management System

![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

## Project Overview

CoreHR is a full-stack, enterprise-grade Human Resource Management system designed to digitize and automate the complete talent and employee lifecycle. Developed with a modular monolith architecture, the system provides a highly responsive Next.js frontend, a robust FastAPI backend with advanced concurrency mechanisms, and an independent AI-powered microservice for automated candidate screening.

## Core Modules & Capabilities

### Authentication & Access Control
- **Granular RBAC:** Employs JWT (JSON Web Token) authentication with strict Role-Based Access Control. Permissions (e.g., `recruitment:manage`, `document:approve`) are dynamically assigned, ensuring secure separation of duties across all modules.

### Employee & Lifecycle Management
- **Centralized Master Records:** Manages complete employee profiles, department allocations, and designation histories. Includes soft-delete protocols to maintain historical audit integrity.

### Recruitment & Applicant Tracking System (ATS)
- **Pipeline Management:** Tracks vacancies from draft to closure. Facilitates candidate progression through configurable interview rounds via an interactive Kanban interface.
- **Public Job Portal:** A standalone external portal for candidate applications, secured by Google reCAPTCHA v2 and duplicate-application defense mechanisms (SHA-256 hash checks and unique email constraints).
- **Interview Panels:** Supports dynamic panel assignment and aggregates multi-dimensional scoring (Technical, Communication, Cultural Fit) into normalized hiring metrics.

### AI-Powered Screening Microservice
- **Decoupled Architecture:** Runs as an independent microservice to ensure heavy LLM inference and document parsing do not degrade the performance of the main HR API.
- **Provider Agnostic:** Configurable to utilize models from Groq (Llama 3), Google Gemini, OpenAI, or Anthropic Claude.
- **Robust Extraction:** Utilizes PyMuPDF for reliable text extraction from complex CVs, bound by strict prompt engineering to prevent data hallucination. Implements a deterministic Regex fallback in the event of API rate limits.

### Document Management & Generation
- **Automated Workflow & Routing:** Implements a Separation of Duties (SoD) routing engine that prevents self-approval of documents and escalates administrative submissions to Super Admins.
- **Template Engine:** Dynamically generates standardized PDFs (e.g., promotion letters, contracts) from HTML and DOCX templates.
- **Background Polling:** Features an IMAP daemon that polls external inboxes for inbound HR requests, utilizing RFC 5322 `Message-ID` idempotency to prevent duplicate record generation.

### Leave Management
- **Automated Calculations:** Handles prorated leave balances, multi-tier approval workflows, and scheduled background notifications for holidays.

## Architecture & Technology Stack

**Frontend Layer:**
- Framework: Next.js (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- Data Fetching: React Server Components and authenticated Client-side wrappers

**Backend Layer (Main System):**
- Framework: FastAPI (Python)
- Database: PostgreSQL (with SQLAlchemy ORM and Alembic migrations)
- Task Scheduling: APScheduler with PostgreSQL Advisory Locks (`pg_try_advisory_lock`) for distributed execution

**AI Microservice Layer:**
- Framework: FastAPI (Python)
- Core Libraries: PyMuPDF (`fitz`), `python-docx`, `openai` SDK

## Development Setup

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- PostgreSQL

### 1. Database Configuration
Create a PostgreSQL database named `hrm_db` and configure the `DATABASE_URL` in `backend/.env`.

### 2. Main Backend Initialization
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```
*The primary API will be available at http://127.0.0.1:8000*

### 3. AI Microservice Initialization
```bash
cd ai_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload
```
*The AI service will be available at http://127.0.0.1:8001*

### 4. Frontend Initialization
```bash
cd frontend
npm install
npm run dev
```
*The web interface will be available at http://localhost:3000*

## Engineering & Security Highlights

- **Asynchronous Execution:** Heavy I/O operations (file uploads, SMTP dispatches, LLM inference) are offloaded to asynchronous background tasks to maintain optimal server response times.
- **Defense-in-Depth:** External endpoints utilize multi-layered validation including payload size limits, MIME-type verification, and cryptographic duplicate detection before database interaction.
- **Audit Traceability:** Critical state changes in the ATS and document pipelines are recorded in immutable audit tables to ensure organizational compliance.