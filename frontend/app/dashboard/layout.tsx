"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "";
  const isSettings = pathname.startsWith('/dashboard/settings');

  // Client-side auth guard — redirect to /login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // While checking auth, show nothing to avoid flash
  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F5F6F8]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }

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