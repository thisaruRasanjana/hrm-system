import Link from "next/link";
import DocumentItem from "../components/DocumentItem";

export default function DocumentsPage() {
  const mandatoryDocs = [
    { status: "approved" },
    { status: "pending" },
    { status: "not_uploaded" },
  ];

  const completed = mandatoryDocs.filter(
    (doc) => doc.status === "approved"
  ).length;

  const percentage = (completed / mandatoryDocs.length) * 100;

  return (
    <div className="space-y-6 w-full">

      {/* Tabs */}
      <div className="inline-flex bg-white p-1 rounded-full shadow-md border">
        <Link
          href="/documents"
          className="px-6 py-2 rounded-full bg-[#F2924E] text-white text-sm font-medium transition"
        >
          My documents
        </Link>

        <Link
          href="/documents/request"
          className="px-6 py-2 rounded-full text-gray-600 text-sm font-medium hover:text-gray-800 transition"
        >
          Request document
        </Link>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-semibold">My Documents</h1>
        <p className="text-sm text-gray-500">
          Upload required documents to complete your employee profile.
        </p>
      </div>

      {/* Progress */}
      <div className="bg-white p-6 rounded-xl shadow-sm">
        <h3 className="font-semibold mb-2">Document Completion</h3>
        <p className="text-sm text-gray-500 mb-3">
          Mandatory Documents:{" "}
          <span className="font-medium">
            {completed} of {mandatoryDocs.length} completed
          </span>
        </p>

        <div className="w-full bg-gray-200 h-2 rounded-full">
          <div
            className="bg-[#F2924E] h-2 rounded-full"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>

        <p className="text-xs text-gray-400 mt-2">
          {mandatoryDocs.length - completed} documents remaining
        </p>
      </div>

      {/* Mandatory */}
      <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Mandatory Documents
        </h2>

        <DocumentItem
          name="Birth Certificate"
          description="Birth certificate copy"
          status="approved"
        />

        <DocumentItem
          name="National ID"
          description="Government issued ID"
          status="pending"
        />

        <DocumentItem
          name="Educational Certificates"
          description="Degree and transcripts"
          status="not_uploaded"
        />
      </div>

      {/* Optional */}
      <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
        <h2 className="font-semibold">Optional Documents</h2>

        <DocumentItem
          name="Additional Certificates"
          description="Professional certifications"
          status="not_uploaded"
        />

        <DocumentItem
          name="Other Supporting Documents"
          description="Any other relevant documents"
          status="not_uploaded"
        />
      </div>
    </div>
  );
}
