"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import DashboardGrid from "@/components/dashboard/DashboardGrid";

export default function DashboardPage() {

  const [editMode, setEditMode] = useState(false);

  return (
    <div>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">

        <div>
          <h1 className="text-xl font-semibold">
            Welcome back, John!
          </h1>

          <p className="text-sm text-gray-500">
            Saturday, February 7, 2026
          </p>
        </div>

        {/* Edit Button */}
        <button
          onClick={() => setEditMode(!editMode)}
          className="p-2 rounded hover:bg-gray-100"
        >
          <Pencil size={20} />
        </button>

      </div>

      {/* Grid */}
      <DashboardGrid editMode={editMode} />

    </div>
  );
}