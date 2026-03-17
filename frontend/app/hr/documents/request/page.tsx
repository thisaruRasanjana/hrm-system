"use client";

import DocumentTabsHR from "../../../components/DocumentTabsHR";

export default function HRRequestDocumentsPage() {
  return (
    <div className="space-y-6">

      <DocumentTabsHR />

      <h1 className="text-2xl font-semibold">
        Requested Documents
      </h1>

      <p className="text-sm text-gray-500">
        Employees can request new documents here.
      </p>

    </div>
  );
}