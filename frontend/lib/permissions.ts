/**
 * Permission string constants — TypeScript side.
 * Must match backend/app/core/permissions.py exactly.
 * Share with entire team.
 */

// Widget permissions — must match strings in the permissions table exactly
export const WIDGET_TIME_TRACKING_VIEW      = "dashboard:view_time_tracking";
export const WIDGET_LEAVE_BALANCE_VIEW      = "dashboard:view_leave_balance";
export const WIDGET_NOTIFICATIONS_VIEW      = "dashboard:view_notifications";
export const WIDGET_WEEKLY_HOURS_VIEW       = "dashboard:view_weekly_hours";
export const WIDGET_CALENDAR_VIEW           = "dashboard:view_calendar";
export const WIDGET_CALENDAR_EDIT           = "dashboard:edit_calendar";
export const WIDGET_APPROVAL_VIEW_APPROVALS = "dashboard:view_approvals";
export const WIDGET_APPROVAL_VIEW_REQUESTS  = "dashboard:view_requests";
export const WIDGET_ANNOUNCEMENTS_VIEW      = "dashboard:view_announcements";
export const WIDGET_ANNOUNCEMENTS_MANAGE    = "dashboard:manage_announcements";
export const WIDGET_EVENTS_VIEW             = "dashboard:view_events";
export const WIDGET_EVENTS_MANAGE           = "dashboard:manage_events";

// Messaging
export const MESSAGING_SEND = "messaging.send";

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
  { key: "weekly_hours",     label: "Weekly Hours",            description: "Weekly hours bar chart",     viewPermission: WIDGET_WEEKLY_HOURS_VIEW       },
  { key: "calendar",         label: "Calendar",                description: "Monthly calendar & holidays",viewPermission: WIDGET_CALENDAR_VIEW           },
  { key: "approval_summary", label: "Approval & Req. Summary", description: "Pending approvals",         viewPermission: WIDGET_APPROVAL_VIEW_APPROVALS },
  { key: "announcements",    label: "Announcements",           description: "Company announcements",      viewPermission: WIDGET_ANNOUNCEMENTS_VIEW      },
  { key: "upcoming_events",  label: "Upcoming Events",         description: "Upcoming company events",    viewPermission: WIDGET_EVENTS_VIEW             },
];
