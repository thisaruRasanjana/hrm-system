"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import { Pencil } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);

  return (
    <div className="flex flex-col gap-6">

      {/* Header — only visible when NOT in edit mode */}
      {!editMode && (
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1F2937]">
              Welcome back, John!
            </h1>
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <button
            onClick={() => setEditMode(true)}
            className="text-gray-500 hover:text-[#F2924E] transition"
            title="Edit dashboard"
          >
            <Pencil size={20} />
          </button>
        </div>
      )}

      {/* Widgets grid (edit mode bar lives inside DashboardGrid) */}
      <DashboardGrid
        editMode={editMode}
        onSave={() => setEditMode(false)}
      />

    </div>
  );
}