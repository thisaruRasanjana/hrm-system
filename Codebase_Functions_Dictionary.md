# Codebase Functions Dictionary

This document explains every single function across your most important files in simple, beginner-friendly language. It lists exactly what each function takes as input, what it outputs, and what it does in a maximum of two sentences.

---

## 1. backend/app/recruitment/service.py
*(The brain of the recruitment module handling all database business logic)*

**`create_vacancy(db, data)`**
- **Input:** Database session, Job details (Title, Description).
- **Returns:** The saved `Vacancy` object.
- **What it does:** Saves a brand new job posting to the database.

**`get_all_vacancies(db)`**
- **Input:** Database session.
- **Returns:** A list of `Vacancy` dictionaries.
- **What it does:** Retrieves all job postings and mathematically calculates exactly how many applicants each job currently has.

**`get_vacancy_by_id(db, vacancy_id)`**
- **Input:** Database session, the specific Job ID.
- **Returns:** A single `Vacancy` object.
- **What it does:** Fetches all the details for one specific job posting so they can be viewed or edited.

**`update_vacancy(db, vacancy_id, data)`**
- **Input:** Database session, Job ID, new modified details.
- **Returns:** The updated `Vacancy` object.
- **What it does:** Modifies an existing job posting (like changing the title or switching it from "Active" to "Closed").

**`delete_vacancy(db, vacancy_id)`**
- **Input:** Database session, Job ID.
- **Returns:** A success message dictionary.
- **What it does:** Permanently deletes a job posting from the database. It also safely deletes all candidate records and scorecards attached to that job.

**`process_cv_background(application_id, cv_file_path, db)`**
- **Input:** Application ID, physical path to the PDF, Database session.
- **Returns:** Nothing (`None`).
- **What it does:** Quietly sends a candidate's CV to the AI microservice in the background. It updates the database with the AI's score without making the user wait or freezing the website.

**`upload_cvs(db, vacancy_id, files)`**
- **Input:** Database session, Job ID, list of physical files.
- **Returns:** An `UploadSummary` object showing success/failure counts.
- **What it does:** Saves uploaded resume files to the server's hard drive using unique UUID names. It then creates the initial candidate records in the database.

**`get_candidates_by_vacancy(db, vacancy_id)`**
- **Input:** Database session, Job ID.
- **Returns:** A list of `Candidate` objects.
- **What it does:** Retrieves a list of every single person who applied for a specific job.

**`get_candidate_profile(db, candidate_id)`**
- **Input:** Database session, Candidate ID.
- **Returns:** A dictionary containing the candidate and their application.
- **What it does:** Fetches a candidate's personal details and links them to their current hiring pipeline status (e.g., "First Round").

**`update_application_notes(db, application_id, notes)`**
- **Input:** Database session, Application ID, text string of notes.
- **Returns:** The updated `Application` object.
- **What it does:** Saves the manual text notes that an HR manager typed during the initial phone screening.

**`upsert_interview_panel(db, vacancy_id, data)`**
- **Input:** Database session, Job ID, list of employee IDs.
- **Returns:** The saved `InterviewPanel` object.
- **What it does:** Links specific internal employees to a job so they are authorized to submit interview scorecards.

**`get_interview_panel(db, vacancy_id)`**
- **Input:** Database session, Job ID.
- **Returns:** The `InterviewPanel` object.
- **What it does:** Retrieves the list of employees who are assigned as interviewers for a specific job.

**`_has_valid_email(email)`**
- **Input:** An email address string.
- **Returns:** A `boolean` (True or False).
- **What it does:** Checks if an email is properly formatted with an "@" symbol. It ensures the system doesn't try to send emails to placeholder text.

**`send_scheduling_link(db, application_id)`**
- **Input:** Database session, Application ID.
- **Returns:** A success message dictionary.
- **What it does:** Triggers the system to email the candidate an invitation link to schedule their first interview.

**`update_candidate_details(db, candidate_id, data)`**
- **Input:** Database session, Candidate ID, updated name/phone/email.
- **Returns:** The updated `Candidate` object.
- **What it does:** Saves any manual edits made to a candidate's profile just in case the AI extracted their contact info incorrectly.

**`create_evaluation(db, application_id, data)`**
- **Input:** Database session, Application ID, the scorecard data.
- **Returns:** The saved `InterviewEvaluation` object.
- **What it does:** Saves a single interviewer's scorecard (rating the candidate from 0 to 5) to the database.

**`get_evaluations(db, application_id)`**
- **Input:** Database session, Application ID.
- **Returns:** A list of `InterviewEvaluation` objects.
- **What it does:** Retrieves every scorecard submitted by the interview panel for a specific candidate.

**`get_final_decision_view(db, application_id)`**
- **Input:** Database session, Application ID.
- **Returns:** A massive dictionary of aggregated data.
- **What it does:** Gathers all interviewer scores, comments, and candidate details into one package. It formats this data specifically for the Panel Head's review dashboard.

**`submit_final_decision(db, application_id, data)`**
- **Input:** Database session, Application ID, the chosen decision.
- **Returns:** The saved `FinalDecision` object.
- **What it does:** Records whether the candidate is officially hired, rejected, or advancing. It then automatically sends the appropriate email to the candidate.

**`trigger_next_round(db, application_id)`**
- **Input:** Database session, Application ID.
- **Returns:** A success message dictionary.
- **What it does:** Advances a candidate's database status to the "Second Round".

**`get_evaluated_candidates(db, vacancy_id)`**
- **Input:** Database session, Job ID.
- **Returns:** A list of candidate dictionaries.
- **What it does:** Returns a list of candidates who have successfully completed their interviews and received scorecards.

**`run_ai_screening(db, candidate_id)`**
- **Input:** Database session, Candidate ID.
- **Returns:** A success message dictionary.
- **What it does:** Manually forces the AI to re-read and score a specific candidate's CV if an error occurred the first time.

---

## 2. backend/app/recruitment/router.py
*(The controller layer that exposes the Service functions as web URLs)*

**`create_vacancy()` / `list_vacancies()` / `get_vacancy()` / `update_vacancy()` / `delete_vacancy()`**
- **Inputs:** HTTP Request data.
- **Returns:** JSON responses.
- **What it does:** These functions act as the HTTP gatekeepers for job postings. They receive data from the frontend network requests and pass them to the service layer.

**`upload_cvs()`**
- **Input:** Multipart form data (physical files).
- **Returns:** Upload summary JSON.
- **What it does:** Provides the web URL endpoint that accepts PDF/DOCX file uploads from the frontend.

**`list_candidates()` / `get_candidate()` / `update_candidate_details()`**
- **Inputs:** Candidate IDs from the URL.
- **Returns:** JSON candidate data.
- **What it does:** Provides the web URLs used by the frontend to fetch and display the applicant lists and individual profiles.

**`serve_file()`**
- **Input:** A file UUID string.
- **Returns:** A direct `FileResponse`.
- **What it does:** Provides the endpoint used to securely download or view a physical PDF resume directly in the web browser.

**`update_application()` / `get_application()` / `send_scheduling_link()`**
- **Inputs:** Application IDs.
- **Returns:** JSON responses.
- **What it does:** Provides the endpoints for managing the hiring pipeline, such as saving phone screening notes or triggering emails.

**`upsert_panel()` / `get_panel()`**
- **Inputs:** Job IDs and Employee IDs.
- **Returns:** JSON panel data.
- **What it does:** Provides the web URLs used to configure which employees are allowed to conduct interviews.

**`submit_evaluation()` / `get_evaluations()`**
- **Inputs:** Scorecard data.
- **Returns:** JSON scorecard data.
- **What it does:** Provides the web URLs that the interactive scorecard UI talks to when saving or loading scores.

**`get_final_decision_view()` / `submit_final_decision()` / `trigger_next_round()`**
- **Inputs:** Decision data.
- **Returns:** JSON decision data.
- **What it does:** Provides the secure endpoints utilized exclusively by the Panel Head to make definitive hiring choices.

**`get_evaluated_candidates()` / `run_ai_screening()`**
- **Inputs:** Job or Candidate IDs.
- **Returns:** JSON responses.
- **What it does:** Provides utility endpoints for seeing who is ready for a final decision or forcing the AI to retry a scan.

---

## 3. backend/app/recruitment/schemas.py
*(Data validation rules, not business logic)*

**`_strip_html(value)`**
- **Input:** Raw string with HTML tags.
- **Returns:** A clean string.
- **What it does:** Uses regex to rip out all HTML tags from job descriptions. It is used to generate plain-text previews.

**`strip_whitespace(cls, v)`**
- **Input:** A string.
- **Returns:** A trimmed string.
- **What it does:** Removes accidental spaces from the beginning or end of user input before it reaches the database.

**`validate_rich_text_length(cls, v)`**
- **Input:** An HTML string.
- **Returns:** The string (if valid) or throws an error.
- **What it does:** Ensures that a massive chunk of HTML text does not exceed the database storage limits.

**`validate_experience_level(cls, v)` / `validate_status(cls, v)` / `validate_decision(cls, v)`**
- **Inputs:** Status strings.
- **Returns:** The string (if valid) or throws an error.
- **What it does:** Enforces strict vocabulary rules (e.g., ensuring a decision is exactly "Job Offered" and not "Offer Job").

---

## 4. backend/app/recruitment/models.py
*(Note: This file contains Database Classes, not functions. Here is what they represent)*

- **`Vacancy`**: Represents the PostgreSQL table storing Job Postings.
- **`Candidate`**: Represents the table storing applicant names, emails, and AI scores.
- **`Application`**: Represents the table linking a Candidate to a specific Vacancy and tracking their status.
- **`InterviewPanel`**: Represents the table recording which employees are assigned to interview for a job.
- **`InterviewEvaluation`**: Represents the table storing individual 0-to-5 scorecard ratings.
- **`FinalDecision`**: Represents the table storing the definitive hire/reject choices.

---

## 5. backend/app/employees/service.py
*(Handles internal company staff operations)*

**`get_all_employees(db)`**
- **Input:** Database session.
- **Returns:** A list of `Employee` objects.
- **What it does:** Retrieves absolutely every employee stored in the database, ordered alphabetically.

**`get_active_employees(db)`**
- **Input:** Database session.
- **Returns:** A list of `Employee` objects.
- **What it does:** Retrieves only employees who currently work at the company (ignoring those who resigned or were fired).

**`get_employee_by_id(db, emp_id)`**
- **Input:** Database session, Employee ID.
- **Returns:** A single `Employee` object.
- **What it does:** Fetches a single employee's complete profile using their unique ID.

**`create_employee(db, data)`**
- **Input:** Database session, new employee details.
- **Returns:** The saved `Employee` object.
- **What it does:** Saves a brand new staff member to the company database.

**`update_employee(db, emp_id, data)`**
- **Input:** Database session, Employee ID, updated details.
- **Returns:** The updated `Employee` object.
- **What it does:** Edits an existing employee's details, such as giving them a promotion to a new job title.

**`deactivate_employee(db, emp_id)`**
- **Input:** Database session, Employee ID.
- **Returns:** The deactivated `Employee` object.
- **What it does:** Marks an employee as inactive instead of deleting them completely. This preserves historical interview records.

---

## 6. backend/app/core/email.py
*(Handles all automated Gmail communication)*

**`send_scheduling_email(to, candidate_name, job_title, interview_link)`**
- **Input:** Email address, names, and Zoom/Meet link.
- **Returns:** Nothing (`None`).
- **What it does:** Connects to Gmail via SMTP and sends a customized email inviting a candidate to an interview.

**`send_job_offer_email(to, candidate_name, job_title)`**
- **Input:** Email address and names.
- **Returns:** Nothing (`None`).
- **What it does:** Connects to Gmail to send a congratulatory email officially offering the candidate the position.

**`send_rejection_email(to, candidate_name, job_title)`**
- **Input:** Email address and names.
- **Returns:** Nothing (`None`).
- **What it does:** Connects to Gmail to send a polite, professional email informing the candidate they were not selected.

---

## 7. ai_service/screener.py
*(The standalone AI brain)*

**`_extract_text(pdf_path)`**
- **Input:** The physical file path.
- **Returns:** A massive text string.
- **What it does:** Opens a physical PDF or DOCX file and rips all the raw text out of it so the AI can read it.

**`_parse_name(text)` / `_parse_email(text)` / `_parse_phone(text)`**
- **Input:** The raw CV text.
- **Returns:** Extracted strings (Name, Email, Phone).
- **What it does:** Uses Regex pattern matching as a backup safety net to extract contact info if the AI crashes.

**`_fallback_result(text)`**
- **Input:** The raw CV text.
- **Returns:** A basic `ScreenResult`.
- **What it does:** Generates a default candidate profile with a 0% score if the Gemini API quota is completely exhausted.

**`screen_cv(cv_file_path, title, description, requirements)`**
- **Input:** The CV file and the Job Description text.
- **Returns:** A complete `ScreenResult` object.
- **What it does:** Sends the CV text securely to Google Gemini AI to analyze. It mathematically calculates the candidate's alignment score out of 100.

---

## 8. Frontend React Pages (In Order)
*(The user interfaces driving the application)*

### `frontend/app/jobs/[id]/page.tsx`
- **`PublicJobPage()`:** Renders the public-facing job description for external candidates to read without logging in.
- **`UploadZone()`:** Renders the visual drag-and-drop box where candidates can drop their CV files.
- **`handleFileSelect()`:** Captures the file locally when a user selects a PDF from their computer.
- **`handleSubmit()`:** Secures the selected CV and pushes it over the network to the backend API.
- **`daysAgo()`:** Calculates how many days have passed since the job was posted (e.g., "Posted 3 days ago").

### `frontend/app/page.tsx` & `layout.tsx`
- **`RootLayout()`:** Defines the master HTML shell, fonts, and metadata that wrap around every single page in the app.
- **`Home()`:** Renders the main welcoming dashboard when an HR manager first logs in.

### `frontend/app/recruitment/page.tsx`
- **`VacancyListPage()`:** Renders the master table showing all current job postings for HR managers.
- **`FilterSelect()`:** Creates the interactive dropdown menus used to filter jobs by department or status.

### `frontend/app/recruitment/create/page.tsx`
- **`VacancyCreatePage()`:** Renders the massive form used by HR to draft a brand new job posting.
- **`handleSubmit()`:** Validates the new job form and sends the massive JSON data payload to the backend.
- **`validate()`:** Checks if all required fields (like Job Title) are properly filled out before allowing submission.
- **`stripHtml()`:** Removes formatting tags to accurately count how many words are in the rich text description.

### `frontend/app/recruitment/[id]/page.tsx`
- **`VacancyDetailPage()`:** Renders the dashboard listing all candidates who applied for a specific job, including their AI scores.
- **`deleteVacancy()`:** Triggers the high-risk API call to permanently delete the job and all its applicants from the database.
- **`copyShareLink()`:** Copies the public URL of the job to the user's clipboard so they can post it on LinkedIn.
- **`rerunAI()`:** Instructs the backend to force the AI to rescore a candidate if there was a network error the first time.

### `frontend/app/recruitment/[id]/upload/page.tsx`
- **`UploadCVPage()`:** Renders the internal HR page for manually uploading a massive batch of candidate resumes at once.
- **`handleDrop()`:** Accepts multiple PDFs simultaneously when dragged and dropped onto the screen.
- **`handleUpload()`:** Sends the batch of CVs to the backend and tells it to trigger the background AI processing for all of them.

### `frontend/app/recruitment/[id]/edit/page.tsx`
- **`EditVacancyPage()`:** Renders the complex form to edit job details and assign internal staff to the interview panel.
- **`loadData()`:** Asynchronously fetches the current job details and the entire list of company employees from the backend.
- **`EmployeeSearch()`:** Renders a highly interactive, searchable dropdown box to easily find an employee by typing their name.
- **`handleSubmit()`:** Saves all modified job text and the newly assigned interviewers back to the database.

### `frontend/app/recruitment/[id]/candidates/[candidateId]/page.tsx`
- **`CandidateProfilePage()`:** Renders the detailed view of a single applicant, showing their CV preview and exact AI reasoning.
- **`saveDetails()` / `saveEmail()`:** Saves any manual edits HR made to correct the candidate's name or email address.
- **`sendLink()`:** Triggers the backend API to physically send the interview scheduling email to the candidate's inbox.
- **`saveNotes()`:** Saves the HR manager's free-text notes taken during the initial phone screening call.

### `frontend/app/recruitment/[id]/candidates/[candidateId]/evaluate/page.tsx`
- **`EvaluateInterviewPage()`:** Renders the interactive scorecard form for a single interviewer to formally rate a candidate.
- **`updateRating()`:** Temporarily records the score (from 0 to 5) when an interviewer clicks a specific rating button on the screen.
- **`calculateScore()`:** Mathematically converts the 5 category ratings into a final percentage score out of 100.
- **`handleSave()`:** Submits the final completed scorecard payload to the backend database to be permanently recorded.

### `frontend/app/recruitment/[id]/candidates/[candidateId]/final-decision/page.tsx`
- **`FinalDecisionPage()`:** Renders the Panel Head's secure dashboard to review all aggregated interview feedback in one place.
- **`RatingPills()`:** Renders small, colored visual badges (Green/Yellow/Red) to easily see if a candidate scored high or low.
- **`handleConfirm()`:** Submits the Panel Head's final, irreversible choice (Offer/Reject) and commands the backend to send the final email.
