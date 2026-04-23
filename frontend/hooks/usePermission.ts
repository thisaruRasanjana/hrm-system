import { useAuth } from "@/context/auth-context";

/**
 * Check if the current user has a single permission.
 * Usage:  const canEdit = usePermission("widget.calendar.edit");
 */
export function usePermission(permission: string): boolean {
  const { user } = useAuth();
  return user?.permissions?.includes(permission) ?? false;
}

/**
 * Check if the current user has ANY of the given permissions.
 * Usage:  const canSeeApprovals = useAnyPermission(["widget.approval_summary.view_approvals", "widget.approval_summary.view_requests"]);
 */
export function useAnyPermission(permissions: string[]): boolean {
  const { user } = useAuth();
  return permissions.some((p) => user?.permissions?.includes(p));
}
