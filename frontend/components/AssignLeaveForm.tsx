"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import LeaveDatePicker from "./LeaveDatePicker";

interface Props {
  balances: Record<string, number>;
  onSubmitted?: () => void;
}

interface LeaveType {
  id: number;
  name: string;
  description?: string | null;
}

function parseYMD(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function calculateWorkingDays(startStr: string, endStr: string, halfDay: boolean, holidays: any[]): number {
  if (!startStr || !endStr) return 0;
  
  const start = parseYMD(startStr);
  const end = parseYMD(endStr);
  
  if (start > end) return 0;
  
  const holidaySet = new Set(holidays.map(h => h.date));
  
  let workingDays = 0;
  let current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    const currentStr = `${y}-${m}-${d}`;
    
    const isHoliday = holidaySet.has(currentStr);
    
    if (!isWeekend && !isHoliday) {
      workingDays++;
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  if (halfDay) {
    return workingDays > 0 ? 0.5 : 0;
  }
  
  return workingDays;
}

const AssignLeaveForm: React.FC<Props> = ({ balances, onSubmitted }) => {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState<string>("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState<string>("");

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
  const [holidays, setHolidays] = useState<any[]>([]);

  // Derived values
  const fromDate = dateSelection.startDate;
  const toDate = dateSelection.endDate;
  const halfDay = dateSelection.halfDay;
  const days = calculateWorkingDays(fromDate, toDate, halfDay, holidays);



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

  const removeFile = (indexToRemove: number) => {
  setAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  useEffect(() => {
    const fetchLeaveTypes = async () => {
      setLoadingTypes(true);
      try {
        const res = await apiFetch(`/leave/types`);
        if (!res.ok) {
          throw new Error("Failed to load leave types");
        }

        const data: LeaveType[] = await res.json();
        setLeaveTypes(data);

        if (data.length > 0) {
          setLeaveTypeId(String(data[0].id));
        }
      } catch (error) {
        setErrors(["Could not load leave types"]);
      } finally {
        setLoadingTypes(false);
      }
    };

    const fetchHolidays = async () => {
      try {
        const res = await apiFetch("/holidays");
        if (res.ok) {
          setHolidays(await res.json());
        }
      } catch (err) {
        console.error("Failed to load holidays:", err);
      }
    };

    const fetchEmployees = async () => {
      try {
        const res = await apiFetch("/employees/");
        if (res.ok) {
          setEmployees(await res.json());
        }
      } catch (err) {
        console.error("Failed to load employees:", err);
      }
    };

    fetchLeaveTypes();
    fetchHolidays();
    fetchEmployees();
  }, []);



  const validate = () => {
  const errs: string[] = [];

  const selectedLeaveType = leaveTypes.find(
    (type) => String(type.id) === leaveTypeId
  );

  if (!employeeId) errs.push("Employee is required");
  if (!leaveTypeId) errs.push("Leave type is required");
  if (!fromDate) errs.push("From date is required");
  if (!toDate) errs.push("To date is required");
  if (fromDate && toDate && new Date(toDate) < new Date(fromDate)) {
    errs.push("To date cannot be earlier than From date");
  }
  if (!reason.trim()) errs.push("Reason is required");

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
    setEmployeeId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setSuccess(false);

  if (!validate()) return;

  setSubmitting(true);

  try {
    let uploadedFileUrls: string[] = [];

    if (attachments.length > 0) {
      for (const file of attachments) {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await apiFetch(`/leave/upload`, {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();

        if (!uploadRes.ok) {
          throw new Error(uploadData.detail || `Failed to upload ${file.name}`);
        }

        uploadedFileUrls.push(uploadData.file_url);
      }
    }

    // ✅ Then submit leave request with file URL
    const payload = {
      employee_id: Number(employeeId),
      leave_type_id: Number(leaveTypeId),
      start_date: fromDate,
      end_date: toDate,
      half_day: halfDay,
      reason: reason,
      attachment_urls: uploadedFileUrls,
    };

    const res = await apiFetch(`/leave/assign`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Failed to submit leave request");
    }

    setSuccess(true);
    resetForm();
    onSubmitted?.();

    setTimeout(() => setSuccess(false), 3000);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong";
    setErrors([message]);
  } finally {
    setSubmitting(false);
  }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-6">
      {success && (
        <div className="bg-green-50 text-green-700 p-2 rounded mb-4">
          Leave assigned successfully — pending HR/Admin approval
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

      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-1">Select Employee</label>
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="w-full border border-gray-200 shadow-sm rounded-lg px-4 py-2.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition"
        >
          <option value="">-- Choose Employee --</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.first_name} {emp.last_name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-1">Leave type</label>
        <select
          value={leaveTypeId}
          onChange={(e) => setLeaveTypeId(e.target.value)}
          disabled={loadingTypes}
          className="w-full border border-gray-200 shadow-sm rounded-lg px-4 py-2.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition"
        >
          {leaveTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-1">Leave Duration</label>
        <LeaveDatePicker
          value={dateSelection}
          onChange={(sel) => setDateSelection(sel)}
          holidays={holidays}
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-1">Total Leave Days</label>
        <input
          type="number"
          value={days}
          readOnly
          className="w-full border border-orange-100 shadow-sm rounded-lg px-4 py-2.5 bg-[#FFF8F1] text-gray-700 focus:outline-none"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-1">Reason for leave</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          className="w-full border border-gray-200 shadow-sm rounded-lg px-4 py-2.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-1">Attachment (optional)</label>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mt-1 flex justify-center items-center px-6 pt-5 pb-6 border border-dashed rounded-xl shadow-sm transition-colors ${
            isDragging
              ? "border-orange-400 bg-orange-50"
              : "border-gray-200 bg-gray-50/50"
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
          className="px-5 py-2.5 rounded-lg border border-gray-200 shadow-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
        >
          Cancel Request
        </button>

        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 rounded-lg bg-[#F2924E] text-white shadow-sm hover:bg-orange-500 transition-colors duration-200 disabled:opacity-50"
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

export default AssignLeaveForm;