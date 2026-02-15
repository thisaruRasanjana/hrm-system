import Link from "next/link";
import { FileText } from "lucide-react";

export default function RequestDocumentPage() {
  return (
    <div className="space-y-8 w-full">

      {/* Tabs */}
      <div className="inline-flex bg-white p-1 rounded-full shadow-md border">
        <Link
          href="/documents"
          className="px-6 py-2 rounded-full text-gray-600 text-sm font-medium hover:text-gray-800 transition"
        >
          My documents
        </Link>

        <Link
          href="/documents/request"
          className="px-6 py-2 rounded-full bg-[#F2924E] text-white text-sm font-medium transition"
        >
          Request document
        </Link>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Request Document
        </h1>
        <p className="text-sm text-gray-500">
          Request employment documents and track your requests.
        </p>
      </div>

      {/* New Request */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-[#F2924E]/20 p-2 rounded-lg">
            <FileText size={18} className="text-[#F2924E]" />
          </div>
          <h3 className="font-semibold text-gray-800">New Request</h3>
        </div>

        <div>
          <label className="text-sm text-gray-600 font-medium">
            Document Type
          </label>
          <input
            type="text"
            className="mt-2 w-full border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#F2924E]"
          />
        </div>

        <div>
          <label className="text-sm text-gray-600 font-medium">
            Purpose of Request
          </label>
          <textarea
            rows={4}
            placeholder="Please describe the purpose of your document request..."
            className="mt-2 w-full border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#F2924E]"
          />
        </div>

        <div className="bg-gray-50 border rounded-lg p-3 text-xs text-gray-500">
          Requested documents will be auto-generated from templates and delivered within 24 hours.
        </div>

        <div className="flex justify-end gap-3">
          <button className="px-4 py-2 text-sm rounded-md bg-[#F2924E] text-white hover:opacity-90 transition">
            Submit Request
          </button>
          <button className="px-4 py-2 text-sm rounded-md bg-gray-100 hover:bg-gray-200 transition">
            Cancel
          </button>
        </div>
      </div>

      {/* Pending */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-semibold text-gray-800">Pending Requests</h3>

        <div className="flex justify-between items-center border rounded-lg p-4">
          <div>
            <p className="font-medium text-sm">Salary Confirmation</p>
            <p className="text-xs text-gray-400">
              Requested on Feb 5, 2026
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="bg-yellow-100 text-yellow-600 px-3 py-1 text-xs rounded-full font-medium">
              Pending
            </span>
            <button className="bg-gray-200 text-xs px-3 py-1 rounded-md">
              View
            </button>
          </div>
        </div>
      </div>

      {/* Previous */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-semibold text-gray-800">Previous Requests</h3>

        <div className="flex justify-between items-center border rounded-lg p-4">
          <div>
            <p className="font-medium text-sm">Bank Letter</p>
            <p className="text-xs text-gray-400">
              Requested on Jan 25, 2026 • Completed on Jan 26, 2026
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="bg-green-100 text-green-600 px-3 py-1 text-xs rounded-full font-medium">
              Completed
            </span>
            <button className="bg-gray-200 text-xs px-3 py-1 rounded-md">
              View
            </button>
            <button className="bg-[#F2924E] text-white text-xs px-3 py-1 rounded-md hover:opacity-90">
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
