/**
 * Permission string constants — TypeScript side.
 * Must match backend/app/core/permissions.py exactly.
 * Share with entire team.
 */

// Widget permissions — must match strings in the permissions table exactly
export const WIDGET_TIME_TRACKING_VIEW      = "widget.time_tracking.view";
export const WIDGET_LEAVE_BALANCE_VIEW      = "widget.leave_balance.view";
export const WIDGET_NOTIFICATIONS_VIEW      = "widget.notifications.view";
export const WIDGET_ATTENDANCE_VIEW         = "widget.attendance.view";
export const WIDGET_CALENDAR_VIEW           = "widget.calendar.view";
export const WIDGET_CALENDAR_EDIT           = "widget.calendar.edit";
export const WIDGET_APPROVAL_VIEW_APPROVALS = "widget.approval_summary.view_approvals";
export const WIDGET_APPROVAL_VIEW_REQUESTS  = "widget.approval_summary.view_requests";
export const WIDGET_ANNOUNCEMENTS_VIEW      = "widget.announcements.view";
export const WIDGET_ANNOUNCEMENTS_MANAGE    = "widget.announcements.manage";
export const WIDGET_EVENTS_VIEW             = "widget.upcoming_events.view";
export const WIDGET_EVENTS_MANAGE           = "widget.upcoming_events.manage";

// Messaging
export const MESSAGING_SEND = "messaging.send";

// Time Tracking / Attendance
export const ATTENDANCE_VIEW_OTHERS = "attendance:view_others";

// ── Widget metadata used by DashboardGrid ────────────────────────────────────
export interface WidgetMeta {
  key: string;
  label: string;
  description: string;
  viewPermission: string;
}

export const WIDGET_META: WidgetMeta[] = [
  { key: "time_tracking",    label: "Time Tracking",           description: "Track your work hours",      viewPermission: WIDGET_TIME_TRACKING_VIEW      },
  { key: "leave_balance",    label: "Leave Balance",           description: "View your leave status",     viewPermission: WIDGET_LEAVE_BALANCE_VIEW      },
  { key: "notifications",    label: "Notifications",           description: "System notifications",       viewPermission: WIDGET_NOTIFICATIONS_VIEW      },
  { key: "weekly_hours",     label: "Attendance",              description: "Weekly hours bar chart",     viewPermission: WIDGET_ATTENDANCE_VIEW         },
  { key: "calendar",         label: "Calendar",                description: "Monthly calendar & holidays",viewPermission: WIDGET_CALENDAR_VIEW           },
  { key: "approval_summary", label: "Approval & Req. Summary", description: "Pending approvals",         viewPermission: WIDGET_APPROVAL_VIEW_APPROVALS },
  { key: "announcements",    label: "Announcements",           description: "Company announcements",      viewPermission: WIDGET_ANNOUNCEMENTS_VIEW      },
  { key: "upcoming_events",  label: "Upcoming Events",         description: "Upcoming company events",    viewPermission: WIDGET_EVENTS_VIEW             },
];
