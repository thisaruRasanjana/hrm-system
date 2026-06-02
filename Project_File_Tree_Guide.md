# Complete Project File Tree & Explanation Guide

This document maps out every folder and significant file in your Human Resources Management System. It provides exactly three sentences explaining the precise purpose of each file, followed by a directory of where your most important functions live.

---

## 1. AI Microservice (`ai_service/`)
*This standalone application is dedicated solely to running Google Gemini AI tasks.*

- **`ai_service/main.py`**: This file acts as the primary entry point for the standalone AI microservice using FastAPI. It defines the HTTP endpoints that accept CV files and job descriptions for processing. It delegates the actual AI parsing logic to the screener module to keep concerns separated.
- **`ai_service/screener.py`**: This file contains the core logic for communicating directly with Google's Gemini AI. It constructs strict prompts instructing the AI on how to read CVs, extract candidate details, and calculate an alignment score out of 100. It dynamically loads API keys and ensures the AI response is correctly formatted as JSON.
- **`ai_service/.env`**: This hidden configuration file securely stores sensitive environment variables like your Gemini API key. It prevents these keys from being hardcoded in your Python scripts, which is a crucial security practice. It also defines which specific Gemini models the microservice should attempt to use.
- **`ai_service/requirements.txt`**: This text file lists all the Python dependencies required strictly for the AI microservice to function. It ensures that libraries like `google-genai` and `fastapi` can be installed quickly by another developer. Keeping these dependencies separate from the main backend prevents conflicting library versions.
- **`ai_service/list_models.py` & `test_models.py`**: These utility scripts are used to query the Google Gemini API to see which models are available and test them outside the web server. They help debug permission issues and verify model responsiveness before integrating them into the complex CV screener. They act as essential safety checks during development.

---

## 2. Main Backend (`backend/`)
*The core Python application managing the database, business logic, and web endpoints.*

### Core System Configuration (`backend/app/core/`)
- **`backend/app/core/config.py`**: This file centralizes all global application settings like database URLs, secret keys, and upload directory paths. It reads values from the environment variables to ensure the application behaves differently in development versus production. It acts as the single source of truth for system-wide constants.
- **`backend/app/core/ai_client.py`**: This file provides a standardized function for the main backend to pass CVs to the AI over the internal network. It abstracts away the complex HTTP network requests into a single callable python function. It acts as the strict communication bridge between the main server and the AI microservice.
- **`backend/app/core/email.py`**: This file provides utility functions for sending automated emails to candidates or employees. It handles the SMTP connection logic and formatting of email templates. It allows other parts of the system to easily send interview links without worrying about mail server protocols.
- **`backend/app/core/security.py`**: This file manages the cryptographic functions used to protect user data within the system. It handles password hashing algorithms and the creation or decoding of JWT (JSON Web Tokens). It ensures that unauthorized users cannot forge access to restricted endpoints.
- **`backend/app/core/storage.py`**: This file handles the safe saving and retrieving of physical files like uploaded PDFs or DOCXs. It ensures that files are saved to the correct directories and provides utilities to generate unique file names. It protects the server from path traversal attacks during file uploads.

### Database Foundation (`backend/app/database/`)
- **`backend/app/database/base.py`**: This file imports all individual database models from across the application into a single central location. It ensures that SQLAlchemy is aware of every table (like Vacancies, Employees, etc.) before it tries to create the database schema. It acts as the master registry for the Object-Relational Mapper.
- **`backend/app/database/database.py`**: This file handles the creation of the actual connection engine to the PostgreSQL or SQLite database. It establishes the session maker which provides active database connections to the rest of the application. It manages the fundamental data link between the Python code and the SQL server.
- **`backend/app/database/deps.py`**: This file contains dependency injection functions specifically designed for FastAPI web routes. It provides a function that automatically yields a fresh database session when a web request starts and safely closes it when the request ends. It ensures proper resource management and prevents server memory leaks.

### Recruitment Module (`backend/app/recruitment/`)
- **`backend/app/recruitment/models.py`**: This file defines the entire database schema for the recruitment lifecycle, including tables for Vacancies, Candidates, Applications, and Interview Panels. It uses Foreign Keys to explicitly link candidates to their specific job applications and evaluation scorecards. It represents the structural backbone of the hiring system.
- **`backend/app/recruitment/router.py`**: This file exposes the massive array of HR-facing endpoints required to manage the recruitment pipeline over the web. It handles incoming requests for creating jobs, setting up interview panels, submitting scorecards, and making final hiring decisions. It acts as a traffic controller, delegating the actual processing of these requests to the service layer.
- **`backend/app/recruitment/public_router.py`**: This file provides unsecured endpoints specifically meant for the public-facing candidate portal. It allows anonymous external users to view open vacancies and submit their CVs without needing to log in. It ensures a clear security boundary is maintained between HR tools and candidate tools.
- **`backend/app/recruitment/schemas.py`**: This file contains the extensive Pydantic validation rules for everything from job descriptions to interview scores. It enforces constraints, such as ensuring interview scores fall strictly between 0 and 5. It guarantees that all data entering the recruitment database is perfectly formatted and safe.
- **`backend/app/recruitment/service.py`**: This file houses the most complex business logic in the system, handling the entire state machine of a candidate's journey. It contains the logic to create vacancies, assign candidates to panels, calculate overall interview scores, and save final HR decisions. It acts as the absolute brain of the recruitment module.
- **`backend/app/recruitment/cv_parser.py` & `ai_service.py`**: These files contain the background task logic responsible for triggering the CV parsing workflow without blocking the web server. They handle reading the physical uploaded file, sending it over HTTP to the AI microservice, and then updating the candidate's database record with the resulting score. They ensure the user interface remains incredibly fast while the AI crunches data.

### Employees Module (`backend/app/employees/`)
- **`backend/app/employees/models.py`**: This file defines the structure of the internal employees table within the database using SQLAlchemy. It specifies columns for personal details like names, contact info, job titles, and departments. It ensures the database can accurately track internal staff who might be assigned to interview panels.
- **`backend/app/employees/router.py`**: This file provides the web endpoints that the frontend calls to retrieve or modify employee data. It exposes routes like fetching the entire list of staff or searching for a specific team member. It connects the frontend web application directly to the backend employee logic.
- **`backend/app/employees/schemas.py`**: This file defines the strict Pydantic validation models for employee-related data passing through the API. It ensures that when a new employee is added, they possess all mandatory fields in the correct data types. It acts as a strict gateway to maintain total data integrity.
- **`backend/app/employees/service.py`**: This file contains the database query logic for creating, retrieving, and updating employee records. It extracts the raw SQL operations into clean Python functions like fetching all staff members ordered by name. It handles the specific business rules surrounding staff management.

### Root Files & Tests (`backend/`)
- **`backend/app/main.py`**: This file is the absolute core entry point for the FastAPI backend server. It initializes the web application, configures CORS middleware to allow frontend communication, and attaches all the individual routers (auth, employees, recruitment) into one massive API. It also handles running startup scripts like creating missing database tables.
- **`backend/create_db.py` & `reset_db.py`**: These are utility scripts used to manually force SQLAlchemy to build or completely destroy the database tables. They are incredibly useful during development when database schemas are rapidly changing. They allow the developer to quickly start with a completely fresh database state.
- **`backend/seed_employees.py`**: This file is used to inject dummy data into the system for testing purposes. It creates fake employee records so that interview panels can be populated without manual data entry. It saves massive amounts of repetitive testing time during development.
- **`backend/tests/test_recruitment.py` & `test_employees.py`**: These files hold robust automated unit tests for the backend logic, validating things like score math and schema constraints. They use mocked database sessions to prove that, for example, a perfect interview score correctly calculates to exactly 100%. They mathematically guarantee the reliability of the application's core algorithms.

---

## 3. Frontend Web Application (`frontend/`)
*The React & Next.js user interface that humans interact with.*

### Core Config (`frontend/`)
- **`frontend/package.json`**: This file defines the Node.js project, outlining all the React, Next.js, and Tailwind CSS dependencies required to build the UI. It contains the essential terminal scripts used to launch the development server. It acts as the blueprint for installing the frontend environment.
- **`frontend/next.config.ts`**: This file configures the deep behavior of the Next.js framework itself. It can be used to set up redirects, configure image security domains, or tweak how the application is bundled for production. It acts as the master control file for the frontend compilation process.
- **`frontend/lib/constants.ts`**: This file centralizes hardcoded values like the overarching `API_BASE_URL` and standardized status strings. It ensures that if the backend server address changes, it only needs to be updated in one single place. It prevents typos across the codebase and makes the UI code much cleaner.

### Reusable Components (`frontend/components/`)
- **`frontend/components/Sidebar.tsx` & `Topbar.tsx`**: These files define the reusable navigation elements visible on almost every internal HR page. They provide links to different modules and maintain the highly consistent layout of the dashboard. They are built as standalone React components so they can be injected into any page seamlessly.
- **`frontend/components/Icons.tsx`**: This file acts as a centralized library for all the complex SVG icons used across the user interface. It exports functional React components that render crisp, scalable icons for buttons and navigation menus. It keeps the actual page code extremely clean and free from massive chunks of raw SVG HTML.
- **`frontend/components/RichTextEditor.tsx`**: This file provides a specialized text area that allows HR managers to intuitively format job descriptions with bold text, lists, and headings. It utilizes a third-party library to render a WYSIWYG (What You See Is What You Get) editor. It greatly improves the professional visual quality of the public job postings.

### Recruitment Pages (`frontend/app/recruitment/`)
- **`frontend/app/recruitment/page.tsx`**: This page is the main control center for HR to view all existing job vacancies. It fetches the list of jobs from the backend and renders them in a clean table layout. It provides the primary entry points for creating new jobs or analyzing existing applicants.
- **`frontend/app/recruitment/create/page.tsx`**: This page contains the extensive form used by HR to draft and publish brand new job vacancies. It utilizes the Rich Text Editor for the job description and sends a massive JSON payload to the backend upon submission. It acts as the very starting point of the recruitment lifecycle.
- **`frontend/app/recruitment/[id]/page.tsx`**: This page serves as the dashboard for a specific job vacancy, listing all candidates who have applied for it. It displays their names, AI scores, and current pipeline statuses in an easily scannable table. It allows HR to quickly sort and identify the most promising applicants.
- **`frontend/app/recruitment/[id]/edit/page.tsx`**: This page provides the interface for modifying the details of an existing vacancy or setting up its interview panel. It allows HR to select internal employees from a searchable dropdown to act as panel members. It bridges the critical gap between the recruitment module and the employee module.
- **`frontend/app/recruitment/[id]/upload/page.tsx`**: This page is where HR (or candidates) actually upload their PDF or DOCX resumes to apply for a job. It handles the physical file selection logic, passes the file securely to the backend, and triggers the AI background parsing. It provides immediate, user-friendly feedback to the user upon a successful upload.
- **`frontend/app/recruitment/[id]/candidates/[candidateId]/page.tsx`**: This page is the highly detailed profile view for a single applicant. It displays a visual preview of their uploaded CV, their exact AI match reasoning, and allows HR to edit their contact details or send interview scheduling links. It represents the central hub for managing an individual candidate's progress.
- **`frontend/app/recruitment/[id]/candidates/[candidateId]/evaluate/page.tsx`**: This page provides the interactive scorecard form used by interview panel members. It presents sliders to quantitatively rate the candidate on metrics like Technical Skills and Cultural Fit out of 5. It calculates and submits the raw data that determines if a candidate passes the interview.
- **`frontend/app/recruitment/[id]/candidates/[candidateId]/final-decision/page.tsx`**: This crucial page is securely reserved for the Panel Head to review all aggregated interview feedback. It displays the average scores from all panel members side-by-side for comparison. It contains the final action buttons used to definitively hire, reject, or advance the candidate.

---

## 4. Where Do My Major Functions Live?
If you are asked to open a specific piece of logic during your review, use this cheat sheet to find exactly which file it lives in:

* **Handling the AI Screening API Call:** `ai_service/screener.py` (Function: `screen_cv`)
* **Creating a new Vacancy in the Database:** `backend/app/recruitment/service.py` (Function: `create_vacancy`)
* **Updating a Candidate's Name/Email:** `backend/app/recruitment/service.py` (Function: `update_candidate_details`)
* **Saving an Interview Evaluation Score:** `backend/app/recruitment/service.py` (Function: `create_evaluation`)
* **Saving a Panel Head's Final Decision:** `backend/app/recruitment/service.py` (Function: `create_final_decision`)
* **Fetching the list of internal Employees:** `backend/app/employees/service.py` (Function: `get_all_employees`)
* **Serving the actual PDF file to the browser:** `backend/app/recruitment/router.py` (Function: `serve_file`)
* **The Background Task for parsing CVs:** `backend/app/recruitment/service.py` (Function: `process_cv_background`)
