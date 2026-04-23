/**
 * Temporary hook — returns a manually entered user identity.
 *
 * When the Auth module is merged by your team, replace the internals of
 * this hook with a call to your auth context (e.g. useAuth()).
 * The return shape stays the same, so NO other file needs to change.
 *
 * Contract:
 *   { name: string, setName: function, employeeId: string | null, isLoading: boolean }
 */

import { useState } from "react";

export function useCurrentUser() {
  // ── TEMPORARY: manual name entry ──
  // Replace this entire hook body with auth context when ready.
  // Example future implementation:
  //   const { user, isLoading } = useAuth();
  //   return { name: user?.fullName ?? "", employeeId: user?.id ?? null, isLoading };

  const [name, setName] = useState("");

  return {
    name,
    setName,         // Remove this when auth is integrated — name will come from context
    employeeId: null as string | null,  // Will be populated by auth
    isLoading: false,
  };
}
