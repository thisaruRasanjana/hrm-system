"use client";
import SidebarHR from "../components/SidebarHR";
import SidebarEmployee from "../components/SidebarEmployee";
import Navbar from "../components/Navbar";
import { useAuth } from "@/context/auth-context";

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { hasPermission, user, loading } = useAuth();

  // HR and Super Admin both have document:type_manage — use it to pick the correct sidebar.
  // While loading, default to the employee sidebar to avoid a flash of the wrong chrome.
  const isHrOrAdmin = !loading && (hasPermission("document:type_manage") || !!user?.is_superadmin);

  return (
    <div className="flex h-screen">
      {isHrOrAdmin ? <SidebarHR /> : <SidebarEmployee />}
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
