"use client";

import SidebarEmployee from "../components/SidebarEmployee";
import Navbar from "../components/Navbar";

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">

      <SidebarEmployee />

      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-7xl flex flex-col">

          <Navbar />

          <main className="flex-1 overflow-y-auto px-12 py-8">
            {children}
          </main>

        </div>
      </div>

    </div>
  );
}