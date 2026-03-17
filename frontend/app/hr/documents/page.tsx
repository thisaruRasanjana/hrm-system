"use client";

import DocumentTabsHR from "../../components/DocumentTabsHR";

export default function HRDocumentsPage() {
  return (
    <div className="space-y-6">

      <DocumentTabsHR />

      <div>
        <h1 className="text-2xl font-semibold">HR Documents</h1>
        <p className="text-gray-500 text-sm">
          Manage employee documents from HR panel.
        </p>
      </div>

    </div>
  );
}