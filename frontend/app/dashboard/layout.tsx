"use client";

import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <div className="flex h-screen">

      {/* Sidebar */}
      <Sidebar />

      {/* Right Side */}
      <div className="flex flex-col flex-1">

        {/* Topbar */}
        <Topbar />

        {/* Page Content */}
        <main className="flex-1 bg-white p-6">
          {children}
        </main>

      </div>

    </div>
  );
}