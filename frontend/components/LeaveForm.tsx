"use client";

import { useState } from "react";

export default function LeaveForm() {
  const [leaveType, setLeaveType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    const data = {
      leaveType,
      fromDate,
      toDate,
      reason,
    };

    console.log("Leave Request:", data);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow space-y-4">
      {/* Leave Type */}
      {/*<div>
        <label className="block text-sm mb-1">Leave Type</label>
        <select
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value)}
          className="w-full border p-2 rounded"
        >
          <option value="">Select Type</option>
          <option value="annual">Annual</option>
          <option value="casual">Casual</option>
          <option value="medical">Medical</option>
          
        </select>
      </div> */}

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>
      </div>

      {/* Reason */}
      <div>
        <label className="block text-sm mb-1">Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full border p-2 rounded"
          rows={4}
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3">
        <button className="px-4 py-2 border rounded">
          Cancel
        </button>

        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-orange-500 text-white rounded"
        >
          Submit Request
        </button>
      </div>
    </div>
  );
}