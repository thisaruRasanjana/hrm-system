"use client";

import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const isSettings = pathname.startsWith('/dashboard/settings');

  return (
    <div className="flex h-screen w-full bg-[#F5F6F8]">

      {/* Sidebar */}
      {!isSettings && <Sidebar />}

      {/* Main Area */}
      <div className={`flex flex-col flex-1 ${isSettings ? 'ml-0' : 'ml-[260px]'}`}>

        {/* Topbar */}
        {!isSettings && (
          <div className="sticky top-0 z-20 bg-white shadow-sm">
            <Topbar />
          </div>
        )}

        {/* Page Content */}
        {isSettings ? (
          <main className="flex-1 flex flex-col overflow-hidden">
            {children}
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto px-8 py-6">
            <div className="max-w-[1400px] mx-auto w-full">
              {children}
            </div>
          </main>
        )}

      </div>

    </div>
  );
}