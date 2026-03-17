"use client";

import SidebarHR from "../components/SidebarHR";
import Navbar from "../components/Navbar";

export default function HRLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">

      <SidebarHR />

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