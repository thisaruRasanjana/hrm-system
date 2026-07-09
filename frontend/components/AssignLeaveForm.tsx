"use client";

import React, { useEffect, useState, useRef } from "react";
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

interface EmployeeOption {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  department_rel?: { id: number; name: string } | null;
  designation?: string | null;
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
  const holidaySet = new Set(holidays.map((h) => h.date));
  let workingDays = 0;
  let current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    const currentStr = `${y}-${m}-${d}`;
    if (!isWeekend && !holidaySet.has(currentStr)) workingDays++;
    current.setDate(current.getDate() + 1);
  }
  if (halfDay) return workingDays > 0 ? 0.5 : 0;
  return workingDays;
}

const AVATAR_COLORS = [
  "bg-orange-100 text-orange-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-teal-100 text-teal-700",
];

function getAvatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function getInitials(first: string, last: string) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();
}

// ─── Searchable Employee Picker ───────────────────────────────────────────────
interface EmployeePickerProps {
  employees: EmployeeOption[];
  value: EmployeeOption | null;
  onChange: (emp: EmployeeOption | null) => void;
  hasError?: boolean;
}

function EmployeePicker({ employees, value, onChange, hasError }: EmployeePickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = employees.filter((emp) => {
    const q = query.toLowerCase();
    return (
      `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(q) ||
      (emp.employee_id || "").toLowerCase().includes(q) ||
      (emp.department_rel?.name || "").toLowerCase().includes(q) ||
      (emp.designation || "").toLowerCase().includes(q)
    );
  });

  const handleSelect = (emp: EmployeeOption) => {
    onChange(emp);
    setOpen(false);
    setQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); setQuery(""); }
  };

  // Selected state: show compact card
  if (value) {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${hasError ? "border-red-300 bg-red-50" : "border-[#EE7F22]/30 bg-[#FFF6EE]"}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${getAvatarColor(value.id)}`}>
          {getInitials(value.first_name, value.last_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{value.first_name} {value.last_name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] font-mono text-gray-400">{value.employee_id}</span>
            {value.department_rel?.name && (
              <>
                <span className="text-gray-200">·</span>
                <span className="text-[11px] text-gray-400">{value.department_rel.name}</span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Change employee"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Search input */}
      <div
        className={`flex items-center gap-2 border rounded-xl px-3.5 py-2.5 bg-white cursor-text transition-all ${
          open
            ? "border-[#EE7F22] ring-2 ring-[#EE7F22]/15"
            : hasError
            ? "border-red-300"
            : "border-gray-200 hover:border-gray-300"
        }`}
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 flex-shrink-0">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search by name, ID or department…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 text-sm text-gray-700 placeholder-gray-400 bg-transparent focus:outline-none"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} className="text-gray-300 hover:text-gray-500 transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="px-3.5 py-2 border-b border-gray-100 flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span className="text-[11px] text-gray-400">
              {filtered.length === employees.length
                ? `${employees.length} employees`
                : `${filtered.length} of ${employees.length} employees`}
            </span>
          </div>

          <ul className="max-h-60 overflow-y-auto divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-gray-400">No employees match your search</li>
            ) : (
              filtered.map((emp) => (
                <li key={emp.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(emp)}
                    className="w-full flex items-center gap-3 px-3.5 py-3 hover:bg-orange-50/50 transition-colors text-left group"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${getAvatarColor(emp.id)}`}>
                      {getInitials(emp.first_name, emp.last_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-[#EE7F22] transition-colors truncate">
                        {emp.first_name} {emp.last_name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] font-mono text-gray-400">{emp.employee_id}</span>
                        {emp.department_rel?.name && (
                          <>
                            <span className="text-gray-200">·</span>
                            <span className="text-[11px] text-gray-400 truncate">{emp.department_rel.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-200 group-hover:text-[#EE7F22] flex-shrink-0 transition-colors">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────
const AssignLeaveForm: React.FC<Props> = ({ balances, onSubmitted }) => {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState<string>("");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);

  const [dateSelection, setDateSelection] = useState({ startDate: "", endDate: "", halfDay: false });
  const [reason, setReason] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [holidays, setHolidays] = useState<any[]>([]);

  const fromDate = dateSelection.startDate;
  const toDate = dateSelection.endDate;
  const halfDay = dateSelection.halfDay;
  const days = calculateWorkingDays(fromDate, toDate, halfDay, holidays);

  const addFiles = (newFiles: FileList | File[]) => {
    setAttachments((prev) => [...prev, ...Array.from(newFiles)]);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) addFiles(e.dataTransfer.files);
  };
  const removeFile = (i: number) => setAttachments((prev) => prev.filter((_, idx) => idx !== i));

  useEffect(() => {
    const fetchLeaveTypes = async () => {
      setLoadingTypes(true);
      try {
        const res = await apiFetch(`/leave/types`);
        if (!res.ok) throw new Error("Failed to load leave types");
        const data: LeaveType[] = await res.json();
        setLeaveTypes(data);
        if (data.length > 0) setLeaveTypeId(String(data[0].id));
      } catch { setErrors(["Could not load leave types"]); }
      finally { setLoadingTypes(false); }
    };
    const fetchHolidays = async () => {
      try { const res = await apiFetch("/holidays"); if (res.ok) setHolidays(await res.json()); } catch {}
    };
    const fetchEmployees = async () => {
      try { const res = await apiFetch("/employees/"); if (res.ok) setEmployees(await res.json()); } catch {}
    };
    fetchLeaveTypes(); fetchHolidays(); fetchEmployees();
  }, []);

  const validate = () => {
    const errs: string[] = [];
    const selectedLeaveType = leaveTypes.find((t) => String(t.id) === leaveTypeId);
    if (!selectedEmployee) errs.push("Employee is required");
    if (!leaveTypeId) errs.push("Leave type is required");
    if (!fromDate) errs.push("From date is required");
    if (!toDate) errs.push("To date is required");
    if (fromDate && toDate && new Date(toDate) < new Date(fromDate))
      errs.push("To date cannot be earlier than From date");
    if (!reason.trim()) errs.push("Reason is required");
    if (selectedLeaveType?.name.toLowerCase().includes("medical") && attachments.length === 0)
      errs.push("Medical leave requires a supporting document");
    setErrors(errs);
    return errs.length === 0;
  };

  const resetForm = () => {
    setDateSelection({ startDate: "", endDate: "", halfDay: false });
    setReason("");
    setAttachments([]);
    setErrors([]);
    setSelectedEmployee(null);
    if (leaveTypes.length > 0) setLeaveTypeId(String(leaveTypes[0].id));
    else setLeaveTypeId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    if (!validate()) return;
    setSubmitting(true);
    try {
      let uploadedFileUrls: string[] = [];
      for (const file of attachments) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await apiFetch(`/leave/upload`, { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.detail || `Failed to upload ${file.name}`);
        uploadedFileUrls.push(uploadData.file_url);
      }
      const payload = {
        employee_id: selectedEmployee!.id,
        leave_type_id: Number(leaveTypeId),
        start_date: fromDate,
        end_date: toDate,
        half_day: halfDay,
        reason,
        attachment_urls: uploadedFileUrls,
      };
      const res = await apiFetch(`/leave/assign`, { method: "POST", body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to submit leave request");
      setSuccess(true);
      resetForm();
      onSubmitted?.();
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Something went wrong"]);
    } finally {
      setSubmitting(false);
    }
  };

  const empError = errors.some((e) => e.toLowerCase().includes("employee"));

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-6">
      {success && (
        <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-3 rounded-xl mb-5 flex items-center gap-2 text-sm font-medium">
          ✓ Leave assigned successfully — pending HR/Admin approval
        </div>
      )}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm">
          <ul className="list-disc list-inside space-y-0.5">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Employee Picker */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Employee</label>
        <EmployeePicker employees={employees} value={selectedEmployee} onChange={setSelectedEmployee} hasError={empError} />
      </div>

      {/* Leave Type */}
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
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* Leave Duration */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Leave Duration</label>
        <LeaveDatePicker value={dateSelection} onChange={(sel) => setDateSelection(sel)} holidays={holidays} />
      </div>

      {/* Total Days */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Leave Days</label>
        <input
          type="number"
          value={days}
          readOnly
          className="w-full border border-orange-100 shadow-sm rounded-xl px-4 py-2.5 bg-[#FFF8F1] text-gray-700 focus:outline-none text-sm font-semibold"
        />
      </div>

      {/* Reason */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason for leave</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="Briefly describe the reason…"
          className="w-full border border-gray-200 shadow-sm rounded-xl px-4 py-2.5 bg-white text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] transition resize-none"
        />
      </div>

      {/* Attachment */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Attachment <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex justify-center items-center px-6 py-8 border border-dashed rounded-xl transition-colors ${
            isDragging ? "border-[#EE7F22] bg-orange-50" : "border-gray-200 bg-gray-50/50"
          }`}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <label htmlFor="file-upload" className="cursor-pointer font-medium text-[#EE7F22] hover:text-orange-600 transition-colors">
                Click to upload
                <input id="file-upload" name="attachments" type="file" multiple className="sr-only"
                  onChange={(e) => { if (e.target.files) addFiles(e.target.files); }} />
              </label>
              <span>or drag and drop</span>
            </div>
            <p className="text-xs text-gray-400">PDF, JPG up to 5MB</p>
          </div>
        </div>

        {attachments.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {attachments.map((file, i) => (
              <li key={i} className="flex items-center justify-between bg-gray-50 border border-gray-100 px-3 py-2 rounded-lg text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 flex-shrink-0">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span className="truncate text-gray-700">{file.name}</span>
                </div>
                <button type="button" onClick={() => removeFile(i)} className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors ml-3">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={resetForm}
          className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel Request
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl bg-[#EE7F22] hover:bg-orange-600 text-white text-sm font-semibold shadow-sm shadow-orange-200 transition-colors disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Request"}
        </button>
      </div>
    </form>
  );
};

export default AssignLeaveForm;