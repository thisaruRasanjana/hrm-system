"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import DashboardGrid from "@/components/dashboard/DashboardGrid";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-[#F2924E] border-t-transparent rounded-full" />
      </div>
    );
  }

  const firstName = user?.first_name || user?.username || "there";
  const permissions = user?.permissions ?? [];

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      {!editMode && (
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1F2937]">
              Welcome back, {firstName}!
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              {user?.role && (
                <span className="ml-2 text-xs font-medium bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                  {user.role}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setEditMode(true)}
            className="text-gray-400 hover:text-[#F2924E] transition"
            title="Customize dashboard"
          >
            <Pencil size={18} />
          </button>
        </div>
      )}

      {/* Permission-filtered widget grid */}
      <DashboardGrid
        editMode={editMode}
        onSave={() => setEditMode(false)}
        permissions={permissions}
      />

    </div>
  );
}