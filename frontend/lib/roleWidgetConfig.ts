/**
 * Role-based widget permission configuration.
 * Mirrors the backend ROLE_WIDGET_CONFIG in dashboard/router.py.
 */

export type WidgetKey =
  | "time_tracking"
  | "leave_balance"
  | "notifications"
  | "weekly_hours"
  | "availability"
  | "calendar"
  | "approval_summary"
  | "announcements"
  | "upcoming_events";

export interface WidgetPermissions {
  /** Which widget keys this role can see */
  allowedWidgets: WidgetKey[];
  /** Can this role create/edit/delete announcements & events? */
  canManageContent: boolean;
  /** Can this role add/delete holidays? */
  canManageHolidays: boolean;
}

const ALL_WIDGETS: WidgetKey[] = [
  "time_tracking",
  "leave_balance",
  "notifications",
  "weekly_hours",
  "availability",
  "calendar",
  "approval_summary",
  "announcements",
  "upcoming_events",
];

const EMPLOYEE_WIDGETS: WidgetKey[] = [
  "time_tracking",
  "leave_balance",
  "notifications",
  "weekly_hours",
  "calendar",
  "announcements",
  "upcoming_events",
];

const TEAM_LEAD_WIDGETS: WidgetKey[] = [
  "time_tracking",
  "leave_balance",
  "notifications",
  "weekly_hours",
  "availability",
  "calendar",
  "announcements",
  "upcoming_events",
];

/** Map of role/position strings → permissions */
const ROLE_PERMISSIONS: Record<string, WidgetPermissions> = {
  super_admin: { allowedWidgets: ALL_WIDGETS, canManageContent: true, canManageHolidays: true },
  Admin: { allowedWidgets: ALL_WIDGETS, canManageContent: true, canManageHolidays: true },
  "HR Manager": { allowedWidgets: ALL_WIDGETS, canManageContent: true, canManageHolidays: true },
  hr: { allowedWidgets: ALL_WIDGETS, canManageContent: true, canManageHolidays: true },
  "Team Lead": { allowedWidgets: TEAM_LEAD_WIDGETS, canManageContent: false, canManageHolidays: false },
  employee: { allowedWidgets: EMPLOYEE_WIDGETS, canManageContent: false, canManageHolidays: false },
  _default: { allowedWidgets: EMPLOYEE_WIDGETS, canManageContent: false, canManageHolidays: false },
};

/**
 * Returns the WidgetPermissions for a given role string.
 * Falls back to `_default` if the role is unknown.
 */
export function getPermissions(role: string | null | undefined): WidgetPermissions {
  if (!role) return ROLE_PERMISSIONS["_default"];
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS["_default"];
}

export { ROLE_PERMISSIONS };
