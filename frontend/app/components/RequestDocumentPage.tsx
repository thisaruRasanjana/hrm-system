export default function RequestDocumentPage() {
  return (
    <div className="space-y-6 w-5xl">

      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-semibold">Request Document</h1>
        <p className="text-sm text-gray-500">
          Request employment documents and track your requests.
        </p>
      </div>

      {/* New Request Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
        <h2 className="font-semibold text-lg">New Request</h2>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">Document Type</label>
            <input
              type="text"
              className="w-full mt-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2924E]"
              placeholder="Enter document type"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Purpose of Request</label>
            <textarea
              rows={3}
              className="w-full mt-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2924E]"
              placeholder="Describe the purpose of your request"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button className="px-4 py-2 rounded-lg text-sm bg-gray-200 hover:bg-gray-300 transition">
              Cancel
            </button>

            <button className="px-4 py-2 rounded-lg text-sm text-white bg-[#F2924E] hover:opacity-90 transition">
              Submit Request
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
