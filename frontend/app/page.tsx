"use client";

/**
 * app/page.tsx
 * ------------
 * Development role-selector home page.
 *
 * WHY this exists: The system uses header-based auth (x-user-id / x-user-roles).
 * In a real deployment an upstream gateway would set these headers after JWT
 * verification. During development, this page lets us simulate different users
 * without a full auth server.
 *
 * The role/userId are persisted to localStorage so they survive page navigation.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

/** Valid roles understood by the backend RBAC layer. */
const AVAILABLE_ROLES = ["employee", "hr"] as const;
type Role = typeof AVAILABLE_ROLES[number];

export default function Home() {
  const [role,   setRole]   = useState<Role>("employee");
  const [userId, setUserId] = useState<string>("1");

  // Restore saved session on mount.
  useEffect(() => {
    const savedRole   = localStorage.getItem("role")   as Role | null;
    const savedUserId = localStorage.getItem("userId");
    if (savedRole && AVAILABLE_ROLES.includes(savedRole)) setRole(savedRole);
    if (savedUserId) setUserId(savedUserId);
  }, []);

  // Persist whenever role or userId change.
  useEffect(() => {
    localStorage.setItem("role",   role);
    localStorage.setItem("userId", userId);
  }, [role, userId]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6">

      {/* ── Role control panel (dev only) ───────────────────────────── */}
      <div className="bg-white border rounded-lg shadow-sm p-6 w-full max-w-xl">
        <h2 className="text-xl font-semibold mb-4">HRMS Role Control (Dev Mode)</h2>

        <div className="mb-4">
          <label htmlFor="role-select" className="text-sm text-gray-600">
            Select Role
          </label>
          <select
            id="role-select"
            className="w-full border p-2 rounded mt-1"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {AVAILABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label htmlFor="user-id-input" className="text-sm text-gray-600">
            User ID
          </label>
          <input
            id="user-id-input"
            className="w-full border p-2 rounded mt-1"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </div>

        <p className="text-sm text-gray-500">
          Role: <b>{role}</b> | User ID: <b>{userId}</b>
        </p>
      </div>

      {/* ── Main dashboard ──────────────────────────────────────────── */}
      <div className="max-w-2xl w-full p-8">
        <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-8 text-center">

          <h1 className="text-2xl font-semibold mb-2">
            Welcome to HRMS ({role.toUpperCase()})
          </h1>

          <p className="text-gray-600 mb-6">Quick access to common tasks.</p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/apply-leave"
              className="inline-block bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition"
            >
              Request Leave
            </Link>

            <Link
              href="/leave-history"
              className="inline-block border border-gray-200 px-6 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition"
            >
              Leave History
            </Link>

            {/* Approval Panel is only relevant for HR users */}
            {role !== "employee" && (
              <Link
                href="/approval"
                className="inline-block border border-orange-200 px-6 py-3 rounded-lg text-orange-700 hover:bg-orange-50 transition"
              >
                Approval Panel
              </Link>
            )}
          </div>

          <div className="mt-6 text-sm text-gray-500 space-y-1">
            <p>Employee → can apply leave and view own history</p>
            <p>HR &rarr; full access including approval panel</p>
          </div>
        </div>
      </div>
    </div>
  );
}