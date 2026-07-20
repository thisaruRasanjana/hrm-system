"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import LeaveDatePicker from "./LeaveDatePicker";

interface Props {
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

const ApplyLeaveForm: React.FC<Props> = ({ onSubmitted }) => {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState<string>("");

  const [dateSelection, setDateSelection] = useState({
    startDate: "",
    endDate: "",
    halfDay: false,
  });
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [holidays, setHolidays] = useState<any[]>([]);

  // Derived values
  const fromDate = dateSelection.startDate;
  const toDate = dateSelection.endDate;
  const halfDay = dateSelection.halfDay;
  const days = calculateWorkingDays(fromDate, toDate, halfDay, holidays);





  useEffect(() => {
    const fetchLeaveTypes = async () => {
      setLoadingTypes(true);
      try {
        const res = await apiFetch(`/leave/types?requestable=true`);
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

    fetchLeaveTypes();
    fetchHolidays();
  }, []);



  const validate = () => {
  const errs: string[] = [];

  const selectedLeaveType = leaveTypes.find(
    (type) => String(type.id) === leaveTypeId
  );

  if (!leaveTypeId) errs.push("Leave type is required");
  if (!fromDate) errs.push("From date is required");
  if (!toDate) errs.push("To date is required");
  if (fromDate && toDate && new Date(toDate) < new Date(fromDate)) {
    errs.push("To date cannot be earlier than From date");
  }
  if (days <= 0) {
    errs.push("Total leave days must be greater than 0. Check for weekends or holidays.");
  }
  if (!reason.trim()) errs.push("Reason is required");

  setErrors(errs);
  return errs.length === 0;
  };
  const resetForm = () => {
    setDateSelection({ startDate: "", endDate: "", halfDay: false });
    setReason("");
    setErrors([]);

    if (leaveTypes.length > 0) {
      setLeaveTypeId(String(leaveTypes[0].id));
    } else {
      setLeaveTypeId("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setSuccess(false);

  if (!validate()) return;

  setSubmitting(true);

  try {


    // ✅ Then submit leave request with file URL
    const payload = {
      leave_type_id: Number(leaveTypeId),
      start_date: fromDate,
      end_date: toDate,
      half_day: halfDay,
      reason: reason,
      attachment_urls: [],
    };

    const res = await apiFetch(`/leave/requests`, {
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

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Leave type</label>
        <div className="relative">
          <select
            value={leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
            disabled={loadingTypes}
            className="appearance-none w-full border border-gray-200 shadow-sm rounded-xl px-4 py-2.5 pr-9 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] transition text-sm"
          >
            {leaveTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
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
        {/sick|doctor|medical|hospital|health|fever|accident|treatment|clinic/i.test(reason) && (
          <div className="mt-2 text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded-lg p-2.5">
            💡 If this is for a medical reason, your manager can reclassify this Casual request as Medical Leave when approving.
          </div>
        )}
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
    </form>
  );
};

export default ApplyLeaveForm;