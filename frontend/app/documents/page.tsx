"use client";

import { useState } from "react";
import DocumentUpload from "../components/DocumentUpload";
import DocumentList from "../components/DocumentList";

export default function MyDocumentsPage() {
  const [refresh, setRefresh] = useState(false);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <DocumentUpload onUploadSuccess={() => setRefresh(!refresh)} />
      <DocumentList refresh={refresh} />
    </div>
  );
}
