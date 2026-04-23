"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [role, setRole] = useState("employee");
  const [userId, setUserId] = useState("1");

  // persist role
  useEffect(() => {
    const savedRole = localStorage.getItem("role");
    const savedUserId = localStorage.getItem("userId");

    if (savedRole) setRole(savedRole);
    if (savedUserId) setUserId(savedUserId);
  }, []);

  useEffect(() => {
    localStorage.setItem("role", role);
    localStorage.setItem("userId", userId);
  }, [role, userId]);


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6">

      {/* ================= ROLE CONTROL PANEL ================= */}
      <div className="bg-white border rounded-lg shadow-sm p-6 w-full max-w-xl">
        <h2 className="text-xl font-semibold mb-4">HRMS Role Control (Dev Mode)</h2>

        {/* Role Selector */}
        <div className="mb-4">
          <label className="text-sm text-gray-600">Select Role</label>
          <select
            className="w-full border p-2 rounded mt-1"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="employee">Employee</option>
            <option value="hr">HR</option>
          </select>
        </div>

        {/* User ID */}
        <div className="mb-4">
          <label className="text-sm text-gray-600">User ID</label>
          <input
            className="w-full border p-2 rounded mt-1"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </div>

        {/* Debug Info */}
        <div className="text-sm text-gray-500">
          Role: <b>{role}</b> | User ID: <b>{userId}</b>
        </div>
      </div>

      {/* ================= MAIN DASHBOARD ================= */}
      <div className="max-w-2xl w-full p-8">
        <div className="bg-white border border-gray-100 rounded-lg shadow-sm p-8 text-center">

          <h1 className="text-2xl font-semibold mb-2">
            Welcome to HRMS ({role.toUpperCase()})
          </h1>

          <p className="text-gray-600 mb-6">
            Quick access to common tasks.
          </p>

          <div className="flex items-center justify-center gap-4">

            <Link
              href="/apply-leave"
              className="inline-block bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition"
              onClick={() => {
                localStorage.setItem("role", role);
                localStorage.setItem("userId", userId);
              }}
            >
              Request Leave
            </Link>

            <Link
              href="/leave-history"
              className="inline-block border border-gray-200 px-6 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition"
              onClick={() => {
                localStorage.setItem("role", role);
                localStorage.setItem("userId", userId);
              }}
            >
              Leave History
            </Link>

            {
              role !== "employee" && (
                <Link href="/approval">Approval Panel</Link>
              )
            }

          </div>

          {/* ROLE INFO PANEL */}
          <div className="mt-6 text-sm text-gray-500">
            <p>Employee → can apply leave + view own history</p>
            <p>Manager → can approve team leave</p>
            <p>HR → full access</p>
          </div>

        </div>
      </div>
    </div>
  );
}