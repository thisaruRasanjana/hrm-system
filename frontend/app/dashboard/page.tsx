"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import { Pencil } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [userName, setUserName] = useState("John");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) return;
        const res = await fetch("http://127.0.0.1:8000/auth/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.first_name) {
            setUserName(data.first_name);
          }
        }
      } catch (err) {
        console.error("Failed to fetch user greeting", err);
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="flex flex-col gap-6">

      {/* Header — only visible when NOT in edit mode */}
      {!editMode && (
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1F2937]">
              Welcome back, {userName}!
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