"use client";

import { useAuth } from "@/context/auth-context";

export default function LeavePage() {
  const { hasAnyPermission, loading } = useAuth();

  const canView = hasAnyPermission([
    "leave:request",
    "leave:view_history",
    "leave:approve",
    "leave:report",
  ]);

  if (loading) return null;

  if (!canView) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 text-sm">
        You don&apos;t have permission to view leave management.
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">
        Leave Management
      </h1>

      <p className="text-gray-500">
        This module will be implemented by the Leave Management team.
      </p>
    </div>
  );
}
