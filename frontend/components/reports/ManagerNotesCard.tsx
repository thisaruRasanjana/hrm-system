"use client";

import React, { useState } from "react";

export default function ManagerNotesCard() {
  const [notes, setNotes] = useState("");

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
      <h3 className="text-sm font-semibold text-gray-800">
        Manager Notes & Recommendations
      </h3>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={5}
        placeholder="Add notes about this employee's performance, disciplinary actions taken, or recommendations for HR..."
        className="mt-4 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 outline-none"
      />

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          These notes will be included in the comprehensive PDF report
        </p>

        <button className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
          Save Notes
        </button>
      </div>
    </div>
  );
}