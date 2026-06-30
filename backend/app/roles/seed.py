"""
roles/seed.py — Comprehensive Permission and Role Seeder.
Seeds all system permissions and default roles on application startup.
Operations are idempotent (safe to re-run).
"""
from sqlalchemy.orm import Session
from app.roles.models import Permission, Role

# ---------------------------------------------------------------------------
# SYSTEM PERMISSIONS
# Format: (permission_name, resource, action, description)
# ---------------------------------------------------------------------------
SYSTEM_PERMISSIONS = [
    # Employee Management
    ("employee:create", "employee", "create", "Create new employees"),
    ("employee:update", "employee", "update", "Edit employee records"),
    ("employee:delete", "employee", "delete", "Delete employees"),
    ("employee:view_all", "employee", "view_all", "View full employee list"),
    ("employee:view_own", "employee", "view_own", "View own profile only"),
    ("role:create", "role", "create", "Create roles"),
    ("role:view", "role", "view", "View roles"),
    ("role:assign", "role", "assign", "Assign roles to users"),

    # Document Management
    ("document:upload_own", "document", "upload_own", "Upload own documents"),
    ("document:request_own", "document", "request_own", "Request own documents"),
    ("document:approve", "document", "approve", "Approve document requests"),
    ("document:request_manage", "document", "request_manage", "Manage all document requests"),
    ("document:template_upload", "document", "template_upload", "Upload document templates"),
    ("document:type_manage", "document", "type_manage", "Manage document types"),

    # Leave Management
    ("leave:request", "leave", "request", "Submit leave requests"),
    ("leave:edit_pending", "leave", "edit_pending", "Edit own pending requests"),
    ("leave:view_history", "leave", "view_history", "View own leave history"),
    ("leave:approve", "leave", "approve", "Approve leave requests"),
    ("leave:reject", "leave", "reject", "Reject leave requests"),
    ("leave:report", "leave", "report", "Generate leave reports"),
    ("leave:type_manage", "leave", "type_manage", "Manage leave types"),

    # Recruitment
    ("recruitment:manage", "recruitment", "manage", "Manage vacancies and pipeline"),
    ("recruitment:view", "recruitment", "view", "View vacancies and applications"),
    ("recruitment:interview_panel", "recruitment", "interview_panel", "Access as interview panel member"),

    # Dashboard
    # Dashboard
    ("widget.time_tracking.view", "dashboard", "view", "View time tracking"),
    ("widget.leave_balance.view", "dashboard", "view", "View leave balance"),
    ("widget.notifications.view", "dashboard", "view", "View notifications"),
    ("widget.attendance.view", "dashboard", "view", "View Attendance"),
    ("widget.calendar.view", "dashboard", "view", "View calendar"),
    ("widget.calendar.edit", "dashboard", "edit", "Edit calendar"),
    ("widget.approval_summary.view_approvals", "dashboard", "view", "View approvals"),
    ("widget.approval_summary.view_requests", "dashboard", "view", "View requests"),
    ("widget.announcements.view", "dashboard", "view", "View announcements"),
    ("widget.announcements.manage", "dashboard", "manage", "Manage announcements"),
    ("widget.upcoming_events.view", "dashboard", "view", "View events"),
    ("widget.upcoming_events.manage", "dashboard", "manage", "Manage events"),
    ("attendance:view_others", "dashboard", "view_others_attendance", "View Others' Attendance"),
    ("time_tracking:edit_overtime_threshold", "dashboard", "edit_overtime_threshold", "Edit Overtime Threshold"),
    ("messaging.send", "messaging", "send", "Send messages"),
    ("messaging.receive", "messaging", "receive", "Receive messages"),
]

# ---------------------------------------------------------------------------
# DEFAULT ROLES CONFIGURATION
# ---------------------------------------------------------------------------
# Super Admin — all permissions except employee self-service ones
# (admins review/approve; they don't submit their own documents or leave)
SUPER_ADMIN_EXCLUDES = {
    "document:upload_own", "document:request_own",
    "leave:request", "leave:edit_pending", "leave:view_history",
    # Self-service dashboard widgets — a super admin has no personal leave
    # balance or submitted document requests, so these don't apply to them.
    "widget.leave_balance.view",
    "widget.approval_summary.view_requests",
}

# Built-in roles seeded by the system. These are protected — they cannot be
# deleted via the API (only custom, user-defined roles may be removed).
SYSTEM_ROLE_NAMES = {"Super Admin", "HR", "Manager", "Employee"}

# HR — Specific list + all dashboard except interview_panel
HR_PERMISSIONS = {
    "employee:create", "employee:update", "employee:delete", "employee:view_all", "employee:view_own",
    "role:create", "role:view", "role:assign",
    "document:upload_own", "document:request_own", "document:approve", "document:request_manage", "document:template_upload", "document:type_manage",
    # leave:type_manage is intentionally NOT granted to HR — Leave Settings
    # (leave types & entitlements) is a super-admin-only area.
    "leave:request", "leave:edit_pending", "leave:view_history", "leave:approve", "leave:reject", "leave:report",
    "recruitment:manage", "recruitment:view",
    "messaging.send", "messaging.receive",
    "time_tracking:edit_overtime_threshold",
    "attendance:view_others",
}
# Add all widget permissions to HR (except interview_panel which is never default)
for p in SYSTEM_PERMISSIONS:
    if p[0].startswith("widget.") or p[0].startswith("dashboard:"):
        HR_PERMISSIONS.add(p[0])

MANAGER_PERMISSIONS = {
    "employee:view_own", "document:upload_own", "document:request_own", "document:approve",
    "leave:request", "leave:edit_pending", "leave:view_history", "leave:approve", "leave:reject",
    "widget.time_tracking.view", "widget.leave_balance.view", "widget.notifications.view",
    "widget.attendance.view", "widget.calendar.view", "widget.approval_summary.view_approvals",
    "widget.approval_summary.view_requests", "widget.announcements.view", "widget.upcoming_events.view",
    "messaging.send", "messaging.receive",
    "attendance:view_others"
}

EMPLOYEE_PERMISSIONS = {
    "employee:view_own", "document:upload_own", "document:request_own",
    "leave:request", "leave:edit_pending", "leave:view_history",
    "widget.time_tracking.view", "widget.leave_balance.view", "widget.notifications.view",
    "widget.attendance.view", "widget.calendar.view", "widget.approval_summary.view_requests",
    "widget.announcements.view", "widget.upcoming_events.view",
    "messaging.receive"
}


def seed_roles(db: Session) -> None:
    """Seed permissions and roles. Safe to call on every startup."""

    # 1. Seed Permissions
    perm_map = {}
    for name, res, act, desc in SYSTEM_PERMISSIONS:
        perm = db.query(Permission).filter_by(permission_name=name).first()
        if not perm:
            perm = Permission(permission_name=name, resource=res, action=act, description=desc)
            db.add(perm)
        else:
            perm.resource = res
            perm.action = act
            perm.description = desc
        
        db.flush()
        perm_map[name] = perm

    db.flush()

    # 2. Cleanup orphaned permissions and roles
    #    Delete permissions that are no longer part of the system definition.
    #    These are leftovers from earlier seed versions (e.g. the old dashboard:*
    #    set replaced by widget.*, or resource-less names like employee:view).
    #    Deleting cascades to role_permissions, so every role loses the stale
    #    link cleanly. No current code references these names, so removal is safe
    #    — and it keeps the Role Management permission list accurate.
    system_perm_names = {p[0] for p in SYSTEM_PERMISSIONS}
    db_perms = db.query(Permission).all()
    for p in db_perms:
        if p.permission_name not in system_perm_names:
            db.delete(p)

    # NOTE: We intentionally do NOT touch non-system roles here. Custom,
    # user-defined roles are a supported feature (created via Role Management),
    # so the seeder must leave them — and their permissions — completely alone.
    # Only the four built-in roles below are (re)synced.

    db.flush()

    # 3. Seed Default Roles
    roles_data = [
        ("Super Admin", "Full system access", [p[0] for p in SYSTEM_PERMISSIONS if p[0] not in SUPER_ADMIN_EXCLUDES]),
        ("HR", "Human Resources management", list(HR_PERMISSIONS)),
        ("Manager", "Team management access", list(MANAGER_PERMISSIONS)),
        ("Employee", "Standard employee access", list(EMPLOYEE_PERMISSIONS)),
    ]

    for role_name, description, perm_names in roles_data:
        role = db.query(Role).filter_by(role_name=role_name).first()
        if not role:
            role = Role(role_name=role_name, description=description)
            db.add(role)
            db.flush()
        else:
            role.description = description
        
        # Link permissions
        role_perms = []
        for p_name in perm_names:
            if p_name in perm_map:
                role_perms.append(perm_map[p_name])
        
        role.permissions = role_perms
    
    db.commit()
