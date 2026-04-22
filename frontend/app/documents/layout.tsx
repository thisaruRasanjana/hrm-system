"use client";
import SidebarHR from "../components/SidebarHR";
import SidebarEmployee from "../components/SidebarEmployee";
import Navbar from "../components/Navbar";
import { useEffect, useState } from "react";
import { hasPermission } from "../components/AuthGuard";

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isHr, setIsHr] = useState<boolean>(false);

  useEffect(() => {
    // If the user has document modification permissions, show the HR-level sidebar
    if (hasPermission("document:manage_types")) {
        setIsHr(true);
    } else {
        setIsHr(false);
    }
  }, []);

  return (
    <div className="flex h-screen">
      {isHr ? <SidebarHR /> : <SidebarEmployee />}
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
