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
      <div className="flex flex-col gap-6">
        {/* Header skeleton */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="skeleton-shimmer h-7 w-56 rounded-lg" aria-hidden="true" />
            <div className="skeleton-shimmer h-4 w-44 rounded" aria-hidden="true" />
          </div>
          <div className="skeleton-shimmer h-6 w-6 rounded" aria-hidden="true" />
        </div>
        {/* Widget grid skeleton */}
        <div className="grid grid-cols-12 gap-4" style={{ gridAutoRows: "120px" }} aria-hidden="true">
          {[
            "col-span-4 row-span-3",
            "col-span-4 row-span-3",
            "col-span-4 row-span-3",
            "col-span-4 row-span-3",
            "col-span-4 row-span-3",
            "col-span-4 row-span-3",
            "col-span-4 row-span-3",
            "col-span-4 row-span-3",
          ].map((span, i) => (
            <div key={i} className={`${span} bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 overflow-hidden`}>
              <div className="flex items-center justify-between">
                <div className="skeleton-shimmer h-4 w-28 rounded" />
                <div className="skeleton-shimmer h-6 w-6 rounded-full" />
              </div>
              <div className="skeleton-shimmer flex-1 rounded-xl" />
            </div>
          ))}
        </div>
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