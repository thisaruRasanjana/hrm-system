"use client";

import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";

/**
 * Leave module layout shell.
 *
 * Wraps /apply-leave, /leave-history, /approval and /reports with the same
 * fixed sidebar and topbar used across the rest of the dashboard, keeping
 * the UX consistent. Pages no longer render their own <Sidebar>/<TopBar>.
 */
export default function LeaveShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-[#F5F6F8] overflow-hidden">

      {/* Shared dashboard sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 ml-[260px] overflow-hidden">

        {/* Shared topbar */}
        <div className="sticky top-0 z-20 bg-white shadow-sm">
          <Topbar />
        </div>

        {/* Page content — scrollable */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}
