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

    # Recruitment
    ("recruitment:manage", "recruitment", "manage", "Manage vacancies and pipeline"),
    ("recruitment:view", "recruitment", "view", "View vacancies and applications"),
    ("recruitment:interview_panel", "recruitment", "interview_panel", "Access as interview panel member"),

    # Dashboard
    ("dashboard:view_time_tracking", "dashboard", "view", "View time tracking"),
    ("dashboard:view_leave_balance", "dashboard", "view", "View leave balance"),
    ("dashboard:view_notifications", "dashboard", "view", "View notifications"),
    ("dashboard:view_weekly_hours", "dashboard", "view", "View weekly hours"),
    ("dashboard:view_calendar", "dashboard", "view", "View calendar"),
    ("dashboard:edit_calendar", "dashboard", "edit", "Edit calendar"),
    ("dashboard:view_approvals", "dashboard", "view", "View approvals"),
    ("dashboard:view_requests", "dashboard", "view", "View requests"),
    ("dashboard:view_announcements", "dashboard", "view", "View announcements"),
    ("dashboard:manage_announcements", "dashboard", "manage", "Manage announcements"),
    ("dashboard:view_events", "dashboard", "view", "View events"),
    ("dashboard:manage_events", "dashboard", "manage", "Manage events"),
    ("dashboard:send_messages", "dashboard", "send", "Send messages"),
    ("dashboard:receive_messages", "dashboard", "receive", "Receive messages"),
]

# ---------------------------------------------------------------------------
# DEFAULT ROLES CONFIGURATION
# ---------------------------------------------------------------------------
# Super Admin — all permissions except document:upload_own and document:request_own
SUPER_ADMIN_EXCLUDES = {"document:upload_own", "document:request_own"}

# HR — Specific list + all dashboard except interview_panel
HR_PERMISSIONS = {
    "employee:create", "employee:update", "employee:delete", "employee:view_all", "employee:view_own",
    "role:create", "role:view", "role:assign",
    "document:upload_own", "document:request_own", "document:approve", "document:request_manage", "document:template_upload", "document:type_manage",
    "leave:request", "leave:edit_pending", "leave:view_history", "leave:approve", "leave:reject", "leave:report",
    "recruitment:manage", "recruitment:view"
}
# Add all dashboard permissions to HR (except interview_panel which is never default)
for p in SYSTEM_PERMISSIONS:
    if p[0].startswith("dashboard:"):
        HR_PERMISSIONS.add(p[0])

MANAGER_PERMISSIONS = {
    "employee:view_own", "document:upload_own", "document:request_own", "document:approve",
    "leave:request", "leave:edit_pending", "leave:view_history", "leave:approve", "leave:reject",
    "dashboard:view_time_tracking", "dashboard:view_leave_balance", "dashboard:view_notifications",
    "dashboard:view_weekly_hours", "dashboard:view_calendar", "dashboard:view_approvals",
    "dashboard:view_requests", "dashboard:view_announcements", "dashboard:view_events",
    "dashboard:send_messages", "dashboard:receive_messages"
}

EMPLOYEE_PERMISSIONS = {
    "employee:view_own", "document:upload_own", "document:request_own",
    "leave:request", "leave:edit_pending", "leave:view_history",
    "dashboard:view_time_tracking", "dashboard:view_leave_balance", "dashboard:view_notifications",
    "dashboard:view_weekly_hours", "dashboard:view_calendar", "dashboard:view_requests",
    "dashboard:view_announcements", "dashboard:view_events", "dashboard:receive_messages"
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
    system_perm_names = {p[0] for p in SYSTEM_PERMISSIONS}
    db_perms = db.query(Permission).all()
    for p in db_perms:
        if p.permission_name not in system_perm_names:
            p.description = "DEPRECATED"
            p.roles = [] # Remove from all roles

    system_role_names = {"Super Admin", "HR", "Manager", "Employee"}
    db_roles = db.query(Role).all()
    for r in db_roles:
        if r.role_name not in system_role_names:
            # We don't necessarily want to delete them if users are assigned, 
            # but we'll clear their permissions to indicate they are legacy
            r.description = f"LEGACY: {r.description}"
            r.permissions = []

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
