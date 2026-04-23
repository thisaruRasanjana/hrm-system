"""
Shared permission string constants.
This is the SINGLE SOURCE OF TRUTH for permission names.
Share this with all team members — the Role Creation UI must use these exact strings.
"""

# ── Widget permissions ──────────────────────────────────────────────────────────

# Time Tracking
WIDGET_TIME_TRACKING_VIEW = "widget.time_tracking.view"

# Leave Balance
WIDGET_LEAVE_BALANCE_VIEW = "widget.leave_balance.view"

# Notifications
WIDGET_NOTIFICATIONS_VIEW = "widget.notifications.view"

# Weekly Hours
WIDGET_WEEKLY_HOURS_VIEW = "widget.weekly_hours.view"

# Calendar
WIDGET_CALENDAR_VIEW = "widget.calendar.view"
WIDGET_CALENDAR_EDIT = "widget.calendar.edit"         # can add/edit holidays

# Approval & Request Summary
WIDGET_APPROVAL_VIEW_APPROVALS = "widget.approval_summary.view_approvals"
WIDGET_APPROVAL_VIEW_REQUESTS  = "widget.approval_summary.view_requests"

# Announcements
WIDGET_ANNOUNCEMENTS_VIEW   = "widget.announcements.view"
WIDGET_ANNOUNCEMENTS_MANAGE = "widget.announcements.manage"  # add/edit/delete

# Upcoming Events
WIDGET_EVENTS_VIEW   = "widget.upcoming_events.view"
WIDGET_EVENTS_MANAGE = "widget.upcoming_events.manage"   # add/edit/delete

# ── Messaging permissions ───────────────────────────────────────────────────────

MESSAGING_SEND = "messaging.send"   # can compose & send messages

# ── Convenience groupings ───────────────────────────────────────────────────────

ALL_PERMISSIONS = [
    WIDGET_TIME_TRACKING_VIEW,
    WIDGET_LEAVE_BALANCE_VIEW,
    WIDGET_NOTIFICATIONS_VIEW,
    WIDGET_WEEKLY_HOURS_VIEW,
    WIDGET_CALENDAR_VIEW,
    WIDGET_CALENDAR_EDIT,
    WIDGET_APPROVAL_VIEW_APPROVALS,
    WIDGET_APPROVAL_VIEW_REQUESTS,
    WIDGET_ANNOUNCEMENTS_VIEW,
    WIDGET_ANNOUNCEMENTS_MANAGE,
    WIDGET_EVENTS_VIEW,
    WIDGET_EVENTS_MANAGE,
    MESSAGING_SEND,
]

EMPLOYEE_PERMISSIONS = [
    WIDGET_TIME_TRACKING_VIEW,
    WIDGET_LEAVE_BALANCE_VIEW,
    WIDGET_NOTIFICATIONS_VIEW,
    WIDGET_WEEKLY_HOURS_VIEW,
    WIDGET_CALENDAR_VIEW,
    WIDGET_ANNOUNCEMENTS_VIEW,
    WIDGET_EVENTS_VIEW,
    # NO messaging.send, NO calendar.edit, NO manage permissions
]

HR_PERMISSIONS = [
    WIDGET_TIME_TRACKING_VIEW,
    WIDGET_LEAVE_BALANCE_VIEW,
    WIDGET_NOTIFICATIONS_VIEW,
    WIDGET_WEEKLY_HOURS_VIEW,
    WIDGET_CALENDAR_VIEW,
    WIDGET_CALENDAR_EDIT,
    WIDGET_APPROVAL_VIEW_APPROVALS,
    WIDGET_APPROVAL_VIEW_REQUESTS,
    WIDGET_ANNOUNCEMENTS_VIEW,
    WIDGET_ANNOUNCEMENTS_MANAGE,
    WIDGET_EVENTS_VIEW,
    WIDGET_EVENTS_MANAGE,
    MESSAGING_SEND,
]
