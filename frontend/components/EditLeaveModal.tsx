'use client';

import React, { useEffect, useState } from 'react';
import { X, UploadCloud, File as FileIcon, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from "@/lib/api";
import LeaveDatePicker from './LeaveDatePicker';

interface LeaveRequest {
  leave_request_id: number;
  employee_id: number;
  leave_type_id: number;
  leave_type_name?: string | null;
  start_date: string;
  end_date: string;
  total_days: number;
  half_day: boolean;
  status: string;
  reason?: string | null;
  attachment_urls?: string[];
}

interface LeaveType {
  id: number;
  name: string;
}

interface EditLeaveModalProps {
  request: LeaveRequest;
  onClose: () => void;
  onSuccess: () => void;
  onDelete: () => void;
}

export default function EditLeaveModal({
  request,
  onClose,
  onSuccess,
  onDelete,
}: EditLeaveModalProps) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState<string>(String(request.leave_type_id));
  const [dateSelection, setDateSelection] = useState({
    startDate: request.start_date,
    endDate: request.end_date,
    halfDay: request.half_day,
  });
  const [reason, setReason] = useState(request.reason || '');
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derived values
  const fromDate = dateSelection.startDate;
  const toDate = dateSelection.endDate;
  const halfDay = dateSelection.halfDay;

  useEffect(() => {
    const fetchLeaveTypes = async () => {
      try {
        const res = await apiFetch(`/leave/types`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setLeaveTypes(data.filter((t: LeaveType) => t.name.toLowerCase() !== 'medical'));
        }
      } catch (err) {
        console.error("Failed to fetch leave types", err);
      }
    };
    fetchLeaveTypes();
  }, []);

  const validate = () => {
    const errs: string[] = [];

    if (!leaveTypeId) errs.push("Leave type is required");
    if (!fromDate) errs.push("From date is required");
    if (!toDate) errs.push("To date is required");
    if (fromDate && toDate && new Date(toDate) < new Date(fromDate)) {
      errs.push("To date cannot be earlier than From date");
    }
    if (!reason.trim()) errs.push("Reason is required");

    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const payload = {
        leave_type_id: parseInt(leaveTypeId),
        start_date: fromDate,
        end_date: toDate,
        half_day: halfDay,
        reason: reason.trim(),
        attachment_urls: request.attachment_urls || [],
      };

      const updateRes = await apiFetch(`/leave/requests/${request.leave_request_id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (!updateRes.ok) {
        const errorData = await updateRes.json();
        throw new Error(errorData.detail || 'Failed to update request');
      }

      toast.success("Changes saved successfully!");
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setErrors([err.message || 'Something went wrong. Please try again.']);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-[600px] rounded-2xl bg-white shadow-xl p-6 flex flex-col my-auto">
        
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-800">Edit Leave Request</h2>
          <button
            type="button"
            onClick={() => !isSubmitting && onClose()}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden max-h-[75vh]">
          
          <div className="flex-1 pr-2 custom-scrollbar overflow-y-auto space-y-5 pb-2">
            <div>
              <label className="block text-sm text-slate-500 mb-2">Leave Type</label>
              <select
                value={leaveTypeId}
                onChange={(e) => setLeaveTypeId(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 shadow-sm rounded-lg bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-50 focus:border-[#F2924E]"
              >
                <option value="" disabled>Select Leave Type</option>
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-500 mb-2">Date Range</label>
              <LeaveDatePicker
                value={dateSelection}
                onChange={setDateSelection}
              />
            </div>

            <div>
              <label className="block text-sm text-slate-500 mb-2">Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 shadow-sm rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-50 focus:border-[#F2924E] resize-none h-24"
                placeholder="Why do you need this leave?"
              />
            </div>

          </div>

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-100 p-3 rounded-lg mb-4">
              <ul className="list-disc list-inside space-y-1">
                {errors.map((err, i) => (
                  <li key={i} className="text-sm text-red-600 font-medium">{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-4 mt-2 shrink-0 flex flex-col gap-3 bg-white border-t border-slate-100">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[#F2924E] hover:bg-[#e07b34] text-white font-medium rounded-md transition-colors shadow-sm disabled:opacity-70"
              >
                {isSubmitting ? (
                  <><Loader2 size={18} className="animate-spin" /> Saving</>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
            
            <button
              type="button"
              onClick={onDelete}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-white hover:bg-red-50 text-red-600 font-medium rounded-md border border-red-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Trash2 size={18} />
              Cancel & Delete Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
