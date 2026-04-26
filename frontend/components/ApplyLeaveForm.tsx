"use client";

import React, { useEffect, useState } from "react";
import { API_BASE_URL, getAuthHeaders } from "../app/lib/api";
import LeaveDatePicker from "./LeaveDatePicker";

interface Props {
  balances: Record<string, number>;
}

interface LeaveType {
  id: number;
  name: string;
  description?: string | null;
}

const ApplyLeaveForm: React.FC<Props> = ({ balances }) => {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState<string>("");

  const [dateSelection, setDateSelection] = useState({
    startDate: "",
    endDate: "",
    halfDay: false,
  });
  const [reason, setReason] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Derived values
  const fromDate = dateSelection.startDate;
  const toDate = dateSelection.endDate;
  const halfDay = dateSelection.halfDay;
  const days = (() => {
    if (!fromDate || !toDate) return 0;
    if (halfDay) return 0.5;
    const diff =
      Math.ceil(
        (new Date(toDate).getTime() - new Date(fromDate).getTime()) /
          (1000 * 60 * 60 * 24)
      ) + 1;
    return diff > 0 ? diff : 0;
  })();



  /** Append new files to the current attachments list. */
  const addFiles = (newFiles: FileList | File[]) => {
    const filesArray = Array.from(newFiles);
    setAttachments((prev) => [...prev, ...filesArray]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  /** Remove a single attachment by its index in the list. */
  const removeFile = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  useEffect(() => {
    const fetchLeaveTypes = async () => {
      setLoadingTypes(true);
      try {
        const res = await fetch(`${API_BASE_URL}/leave/types`);
        if (!res.ok) {
          throw new Error("Failed to load leave types");
        }

        const data: LeaveType[] = await res.json();
        setLeaveTypes(data);
        // do NOT auto-select — leave empty so placeholder shows

      } catch (error) {
        setErrors(["Could not load leave types"]);
      } finally {
        setLoadingTypes(false);
      }
    };

    fetchLeaveTypes();
  }, []);



  /**
   * Validate the form before submission.
   * Returns true when all rules pass; populates the errors state otherwise.
   */
  const validate = (): boolean => {
    const errs: string[] = [];

    const selectedLeaveType = leaveTypes.find(
      (type) => String(type.id) === leaveTypeId
    );

    if (!leaveTypeId) errs.push("Leave type is required");
    if (!fromDate)    errs.push("From date is required");
    if (!toDate)      errs.push("To date is required");

    if (fromDate && toDate && new Date(toDate) < new Date(fromDate)) {
      errs.push("To date cannot be earlier than From date");
    }

    if (!reason.trim()) errs.push("Reason is required");

    // Medical leave always requires a supporting document.
    if (
      selectedLeaveType?.name.toLowerCase().includes("medical") &&
      attachments.length === 0
    ) {
      errs.push("Medical leave requires a supporting document");
    }

    setErrors(errs);
    return errs.length === 0;
  };
  const resetForm = () => {
    setDateSelection({ startDate: "", endDate: "", halfDay: false });
    setReason("");
    setAttachments([]);
    setErrors([]);

    if (leaveTypes.length > 0) {
      setLeaveTypeId(String(leaveTypes[0].id));
    } else {
      setLeaveTypeId("");
    }
  };

  /** Upload attachments then POST the leave request to the backend. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);

    if (!validate()) return;

    setSubmitting(true);

    try {
      const uploadedFileUrls: string[] = [];

      // Upload each attachment sequentially and collect the returned URLs.
      for (const file of attachments) {
        const formData = new FormData();
        formData.append("file", file);

        // Remove Content-Type so the browser sets the correct multipart boundary.
        const headers = getAuthHeaders() as Record<string, string>;
        delete headers["Content-Type"];

        const uploadRes  = await fetch(`${API_BASE_URL}/leave/upload`, {
          method: "POST",
          headers,
          body: formData,
        });
        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(uploadData.detail ?? `Failed to upload ${file.name}`);
        }

        uploadedFileUrls.push(uploadData.file_url);
      }

      // Submit the leave request with the uploaded file URLs.
      const payload = {
        leave_type_id:   Number(leaveTypeId),
        start_date:      fromDate,
        end_date:        toDate,
        half_day:        halfDay,
        reason:          reason,
        attachment_urls: uploadedFileUrls,
      };

      const res  = await fetch(`${API_BASE_URL}/leave/requests`, {
        method:  "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail ?? "Failed to submit leave request");
      }

      setSuccess(true);
      resetForm();
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      setErrors([message]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 mt-6">
      {success && (
        <div className="bg-green-50 text-green-700 p-2 rounded mb-4">
          Leave Request Submitted Successfully
        </div>
      )}

      {errors.length > 0 && (
        <div className="bg-red-50 text-red-700 p-2 rounded mb-4">
          <ul className="list-disc list-inside">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Leave type</label>
          <select
            value={halfDay ? leaveTypes.find(t => t.name === 'Annual Leave')?.id?.toString() || leaveTypeId : leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
            disabled={loadingTypes || halfDay}
            className={`w-full border-none shadow-sm focus:outline-none focus:ring-0 rounded-lg px-3 py-2 ${
              loadingTypes || halfDay ? "bg-gray-100 cursor-not-allowed text-gray-400" : "bg-white"
            } ${!leaveTypeId && !halfDay ? "text-gray-400" : "text-[#6C6C70]"}`}
          >
            <option value="" disabled>Select leave type</option>
            {leaveTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} {halfDay && type.name === 'Annual Leave' ? '(Required for Half Day)' : ''}
              </option>
            ))}
          </select>

        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Leave Duration</label>
          <LeaveDatePicker
            value={dateSelection}
            onChange={(sel) => setDateSelection(sel)}
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-1">Total Leave Days</label>
        <input
          type="number"
          value={days}
          readOnly
          className="w-full border-none shadow-sm focus:outline-none focus:ring-0 rounded-lg px-3 py-2 bg-[#FFF3E6] text-[#6C6C70]"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-1">Reason for leave</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          className="w-full border-none shadow-sm focus:outline-none focus:ring-0 rounded-lg px-3 py-2 bg-white text-[#6C6C70]"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-1">Attachment (optional)</label>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mt-1 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-dashed rounded-xl transition-colors ${
            isDragging
              ? "border-orange-500 bg-orange-50"
              : "border-gray-300 bg-white"
          }`}
        >  
           <div className="flex flex-col items-center space-y-2">
            <div className="text-gray-400">Upload file</div>

            <div className="flex text-sm text-gray-600">
              <label
                htmlFor="file-upload"
                className="relative cursor-pointer rounded-md bg-white font-medium text-orange-600 hover:text-orange-500"
              >
                <span>Click to upload</span>
                <input
                  id="file-upload"
                  name="attachments"
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files) {
                      addFiles(e.target.files);
                    }
                  }}
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>

            <p className="text-xs text-gray-500">PDF, JPG up to 5MB</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={resetForm}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors duration-200"
        >
          Cancel Request
        </button>

        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors duration-200 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Request"}
        </button>
      </div>


      {attachments.length > 0 && (
        <div className="mt-3 text-sm text-gray-700">
          <p className="font-medium mb-1">Selected documents:</p>
          <ul className="space-y-2">
            {attachments.map((file, index) => (
              <li
                key={index}
                className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded"
              >
                <span>{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
};

export default ApplyLeaveForm;