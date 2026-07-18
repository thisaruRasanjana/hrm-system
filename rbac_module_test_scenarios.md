# Test Specification Document: Role-Based Access Control (RBAC) Module

**Project:** Human Resource Management (HRM) System  
**Module:** Role-Based Access Control (RBAC)  
**Status:** Ready for Submission  
**Date:** July 18, 2026  

---

## 1. Overview

This document outlines the test scenarios and test cases designed to verify the correctness, reliability, and security of the **Role-Based Access Control (RBAC)** module. The system supports the following built-in system roles and a set of granular permissions that can be composed into custom roles.

### 1.1 Built-in System Roles

| Role | Key Permissions |
|---|---|
| Admin | All permissions |
| HR Manager | Full document management (upload, view, generate, approve) |
| Manager | Employee view/edit, document view, leave approval, reports |
| Employee | Document view/upload, leave view |

### 1.2 Granular Permissions

| Permission | Description |
|---|---|
| `employee:view` | View employee records |
| `employee:create` | Add new employees |
| `employee:edit` | Edit existing employee details |
| `employee:delete` | Deactivate or delete employees |
| `document:view` | View documents |
| `document:upload` | Upload documents |
| `document:approve` | Approve or reject documents |
| `document:generate` | Generate documents from templates |
| `leave:view` | View leave records |
| `leave:approve` | Approve or reject leave requests |
| `recruitment:view` | View recruitment applications |
| `recruitment:manage` | Manage recruitment pipeline |
| `report:view` | View system reports |

---

## 2. Test Scenarios & Detailed Test Cases

---

### TS-01: Assign Existing Role to User
*   **Test Case ID:** TC-RBAC-001
*   **Test Type:** Functional / Integration
*   **Objective:** Verify that an existing system role can be successfully assigned to a user account.
*   **Pre-conditions:** Admin is logged in. At least one user and one role (e.g., "HR Manager") already exist in the system.
*   **Steps:**
    1. Navigate to Employee Management → select a target employee.
    2. Navigate to "Assign Role" for that employee.
    3. Select the role "HR Manager" from the available roles dropdown.
    4. Click "Save" or "Assign".
    5. Log out and log back in as that employee.
*   **Expected Result:**
    *   The role is assigned and saved successfully.
    *   A success confirmation message is shown.
    *   Upon next login, the employee gains all permissions associated with "HR Manager".

---

### TS-02: Create Custom Role with Valid Data
*   **Test Case ID:** TC-RBAC-002
*   **Test Type:** End-to-End
*   **Objective:** Verify that an administrator can create a new custom role with a name and a valid selection of permissions.
*   **Pre-conditions:** Admin is logged in. Access to Roles management is available.
*   **Steps:**
    1. Navigate to Settings → Roles → "Create New Role".
    2. Enter a role name: "Payroll Manager".
    3. Select permissions: `employee:view`, `report:view`.
    4. Click "Create Role".
*   **Expected Result:**
    *   The new role "Payroll Manager" appears in the roles list.
    *   The role is stored in the database with the correct permissions.
    *   The role is available in the "Assign Role" dropdown.

---

### TS-03: Create Role Without Name
*   **Test Case ID:** TC-RBAC-003
*   **Test Type:** UI & API Validation
*   **Objective:** Ensure that the system prevents creation of a role without a name.
*   **Pre-conditions:** Admin is on the "Create New Role" page.
*   **Steps:**
    1. Leave the role name field empty.
    2. Select some permissions.
    3. Click "Create Role".
*   **Expected Result:**
    *   Form submission is blocked.
    *   An inline validation error is shown: "Role name is required."
    *   No API call is made, or the backend returns `422 Unprocessable Entity`.

---

### TS-04: Create Role with No Permissions
*   **Test Case ID:** TC-RBAC-004
*   **Test Type:** Business Rules Validation
*   **Objective:** Verify system behaviour when a role is created with a name but zero permissions selected.
*   **Pre-conditions:** Admin is on the "Create New Role" page.
*   **Steps:**
    1. Enter a valid role name: "Empty Role".
    2. Do not select any permissions.
    3. Click "Create Role".
*   **Expected Result:**
    *   System either blocks creation with a warning "Please select at least one permission." **OR** creates the role with no permissions (zero-access role), depending on business rules.
    *   If created, assigning this role to a user grants no access to any protected resources.

---

### TS-05: Edit Role Permissions
*   **Test Case ID:** TC-RBAC-005
*   **Test Type:** Integration
*   **Objective:** Verify that an administrator can edit the permissions of an existing custom role and that changes take effect immediately.
*   **Pre-conditions:** A custom role "Payroll Manager" exists with permissions `employee:view`, `report:view`. An employee is assigned this role and is logged in.
*   **Steps:**
    1. Navigate to Settings → Roles → select "Payroll Manager".
    2. Add permission `leave:view` and remove `report:view`.
    3. Click "Save Changes".
    4. Ask the assigned employee to refresh their session or re-login.
*   **Expected Result:**
    *   The permissions update is saved.
    *   The employee now sees the leave section but can no longer access reports.
    *   Updated permissions are reflected in the database immediately.

---

### TS-06: Delete Custom Role
*   **Test Case ID:** TC-RBAC-006
*   **Test Type:** Functional
*   **Objective:** Verify that an administrator can delete a custom role that is not currently assigned to any user.
*   **Pre-conditions:** A custom role "Old Role" exists and has no active user assignments.
*   **Steps:**
    1. Navigate to Settings → Roles.
    2. Select "Old Role".
    3. Click "Delete Role".
    4. Confirm the deletion in the confirmation prompt.
*   **Expected Result:**
    *   "Old Role" is removed from the roles list.
    *   The role is deleted from the database.
    *   A success message "Role deleted successfully" is displayed.

---

### TS-07: Prevent Deletion of System Roles
*   **Test Case ID:** TC-RBAC-007
*   **Test Type:** Security / Business Rules
*   **Objective:** Verify that built-in system roles (Admin, HR Manager, Manager, Employee) cannot be deleted by any user, including Admins.
*   **Pre-conditions:** Admin is logged in. Built-in roles are visible in the roles list.
*   **Steps:**
    1. Navigate to Settings → Roles.
    2. Select the system role "Admin".
    3. Attempt to click "Delete Role" (button may be disabled or hidden).
    4. If a delete option exists, try to confirm the deletion.
*   **Expected Result:**
    *   The "Delete" button is disabled or not displayed for system roles.
    *   If a delete request is sent directly via API, the backend returns `403 Forbidden` or `400 Bad Request` with message "System roles cannot be deleted."
    *   The system role remains intact.

---

### TS-08: Restrict Access to Unauthorized Pages
*   **Test Case ID:** TC-RBAC-008
*   **Test Type:** Security / Authorization
*   **Objective:** Verify that users without the required permissions cannot access restricted pages even by navigating to the URL directly.
*   **Pre-conditions:** A user with the "Employee" role is logged in. The employee does NOT have `employee:create` or `report:view` permissions.
*   **Steps:**
    1. Log in as an "Employee" role user.
    2. Manually navigate in the browser to `/dashboard/EmployeeManagement/add`.
    3. Manually navigate to `/dashboard/reports`.
*   **Expected Result:**
    *   The user is redirected to an authorized page (e.g., their dashboard) or shown a "403 Forbidden / Access Denied" page.
    *   The restricted page content is never rendered.

---

### TS-09: Hide Restricted Buttons
*   **Test Case ID:** TC-RBAC-009
*   **Test Type:** UI / Authorization
*   **Objective:** Verify that action buttons (e.g., "Add Employee", "Delete", "Generate Document") are hidden in the UI for users who lack the corresponding permissions.
*   **Pre-conditions:** A user with "Manager" role is logged in. Manager does NOT have `employee:create` or `employee:delete` permissions.
*   **Steps:**
    1. Log in as a "Manager" role user.
    2. Navigate to the Employee Management page.
    3. Observe the UI for the "Add Employee" and "Delete" buttons.
*   **Expected Result:**
    *   The "Add Employee" button is not visible in the UI.
    *   The "Delete" action is not rendered in the employee table row.
    *   No restricted controls appear in the interface.

---

### TS-10: Verify Permission Enforcement After Login
*   **Test Case ID:** TC-RBAC-010
*   **Test Type:** End-to-End / Security
*   **Objective:** Verify that permissions assigned to a role are correctly enforced in both UI rendering and API responses immediately after user login.
*   **Pre-conditions:** A user with "HR Manager" role exists.
*   **Steps:**
    1. Log in as the HR Manager user.
    2. Navigate to the Document Management section.
    3. Verify that "Approve", "Generate", "Upload" actions are available.
    4. Navigate to the Reports section.
    5. Verify access based on whether `report:view` is part of the HR Manager role.
    6. Attempt an API call (e.g., `DELETE /employees/{id}`) from the browser dev tools.
*   **Expected Result:**
    *   UI controls match the permissions defined for "HR Manager".
    *   Any unauthorized API call returns `403 Forbidden`.
    *   Access is consistent between the frontend UI and the backend API.

---

### TS-11: Assign Multiple Roles (If Supported)
*   **Test Case ID:** TC-RBAC-011
*   **Test Type:** Functional
*   **Objective:** Verify system behaviour when a user is assigned more than one role, and validate whether permissions are combined (additive) or follow a priority model.
*   **Pre-conditions:** Multi-role assignment is supported. User exists with no current role.
*   **Steps:**
    1. Assign role "Manager" to the user (permissions: `employee:view`, `employee:edit`).
    2. Also assign role "Payroll Manager" (permissions: `employee:view`, `report:view`).
    3. Log in as that user.
    4. Check accessible sections and API permissions.
*   **Expected Result:**
    *   The user can access pages covered by both roles (i.e., `employee:view`, `employee:edit`, `report:view` — additive model).
    *   No permission from either role is lost.
    *   If multi-role is not supported, the system prevents assigning a second role and displays a clear message.

---

### TS-12: Update Permissions Dynamically
*   **Test Case ID:** TC-RBAC-012
*   **Test Type:** Integration / Security
*   **Objective:** Verify that when a role's permissions are updated, the change is enforced for all users currently assigned that role without requiring those users to log out and back in.
*   **Pre-conditions:** User A is logged in with role "Payroll Manager" which currently has `report:view`. Admin is also logged in in a separate session.
*   **Steps:**
    1. While User A is logged in, Admin removes the `report:view` permission from the "Payroll Manager" role and saves.
    2. User A (without logging out) navigates to the Reports page or refreshes the page.
    3. User A also makes an API call to `GET /reports/`.
*   **Expected Result:**
    *   The reports page is no longer accessible to User A upon refresh.
    *   The API call returns `403 Forbidden`.
    *   Permission revocation is effective dynamically (or upon next API call/session refresh, depending on implementation).
