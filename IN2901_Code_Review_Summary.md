# IN2901 Code Review — Module Improvements

This document outlines all the modifications made to the Recruitment Module codebase to maximize marks against the university rubric.

## Section A: Code Formatting & Cleanliness
- **Indentation & Alignment**: Standardized across the entire backend (FastAPI) and frontend (Next.js). Python files now adhere to strict PEP-8 indentation.
- **Naming Conventions**: Enforced `snake_case` for Python variables/functions, `PascalCase` for Python classes and React components, and `camelCase` for TypeScript variables/functions.
- **Documentation**: Added comprehensive docstrings to all Python modules (`models.py`, `schemas.py`, `service.py`, `router.py`, `cv_parser.py`) explaining the *what* and *why* of each function.
- **Dead Code**: Removed all commented-out, unused code blocks (e.g., legacy print statements and deprecated `on_event` handlers).
- **Magic Numbers & Hardcoded Literals**: 
  - Extracted backend status strings to centralized constants (e.g., `STATUS_ACTIVE`).
  - Extracted frontend configuration and status strings into `frontend/lib/constants.ts` (e.g., `VACANCY_STATUS`, `API_BASE_URL`).
  - Extracted logic values like `MAX_FILE_SIZE_BYTES` and `EVALUATION_MAX_TOTAL` into named constants.
- **Separation of Concerns**: Enforced strict MVC pattern in the backend. Routers handle only HTTP, Services handle pure database logic, Models define the database schema, and Schemas define input validation. 

## Section B: Contribution (Addressing "Thin" Areas)
The original module had a very lightweight `Employee` model that was insufficient for a robust HRM system. To address this, we implemented the following expansions:
1.  **Employee Profile Expansion**: Expanded `models.Employee` with essential fields (`email`, `department`, `job_title`, `employee_number`, `gender`, `date_joined`, and `is_active`).
2.  **Employee Service Layer**: Created a full CRUD service layer with soft-delete capabilities to preserve historical interview panel data.
3.  **Future Feature Suggestion**: To further enrich the module, the next iteration could include an **Offer Generation Engine** that takes the `FinalDecision` and automatically generates a PDF offer letter template using the candidate's data and the vacancy details.

## Section C: Knowledge & Quality (60 points)
This section represents the core engineering quality of the module.
- **Database Schema Audit**: Optimized SQLAlchemy models by replacing generic types with precise, constrained types. Changed `Integer` scores to `SmallInteger`, enforced `String(254)` for email lengths, and added `nullable=False` constraints where appropriate.
- **Strict Input Validation**: Implemented robust Pydantic schemas. 
  - Created bounded integer constraints (e.g., scores must be 0–5).
  - Used `EmailStr` for strict RFC-5322 validation.
  - Added HTML-stripping validators to ensure rich-text fields contain actual visible content.
- **Comprehensive Error Handling**: Wrapped all critical database operations (`db.commit()`), file system I/O, and external API calls in `try/except` blocks.
  - Prevented silent failures by logging exceptions instead of using bare `print()`.
  - Ensured specific, actionable `HTTPException` responses are returned to the frontend.
- **Unit Testing**: Implemented a comprehensive Pytest suite (`tests/test_recruitment.py` and `tests/test_employees.py`).
  - Contains full schema validation tests.
  - Tests the scoring normalization logic.
  - Tests service layer CRUD functions using mocked database sessions to verify edge-case behavior without side effects.
  - Validates CV parsing accuracy.
