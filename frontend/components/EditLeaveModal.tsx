'use client';

import React, { useEffect, useState } from 'react';
import { X, UploadCloud, File as FileIcon, Loader2, Trash2 } from 'lucide-react';
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
  const [existingUrls, setExistingUrls] = useState<string[]>(request.attachment_urls || []);
  const [newAttachments, setNewAttachments] = useState<File[]>([]);
  
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Derived values
  const fromDate = dateSelection.startDate;
  const toDate = dateSelection.endDate;
  const halfDay = dateSelection.halfDay;

  useEffect(() => {
    const fetchLeaveTypes = async () => {
      try {
        const res = await apiFetch(`/leave/types`);
        if (res.ok) {
          const data = await res.json();
          setLeaveTypes(data);
        }
      } catch (err) {
        console.error("Failed to fetch leave types", err);
      }
    };
    fetchLeaveTypes();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setNewAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
      setErrors([]);
    }
  };

  const removeNewFile = (index: number) => {
    setNewAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingFile = (index: number) => {
    setExistingUrls(prev => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    const errs: string[] = [];
    const selectedLeaveType = leaveTypes.find(t => String(t.id) === leaveTypeId);

    if (!leaveTypeId) errs.push("Leave type is required");
    if (!fromDate) errs.push("From date is required");
    if (!toDate) errs.push("To date is required");
    if (fromDate && toDate && new Date(toDate) < new Date(fromDate)) {
      errs.push("To date cannot be earlier than From date");
    }
    if (!reason.trim()) errs.push("Reason is required");

    if (
      selectedLeaveType?.name.toLowerCase().includes("medical") &&
      existingUrls.length === 0 && newAttachments.length === 0
    ) {
      errs.push("Medical leave requires a supporting document");
    }

    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      let uploadedFileUrls: string[] = [...existingUrls];

      if (newAttachments.length > 0) {
        for (const file of newAttachments) {
          const formData = new FormData();
          formData.append('file', file);

          const uploadRes = await apiFetch(`/leave/upload`, {
            method: 'POST',
            body: formData,
          });

          if (!uploadRes.ok) {
            throw new Error(`Failed to upload ${file.name}`);
          }
          const uploadData = await uploadRes.json();
          uploadedFileUrls.push(uploadData.file_url);
        }
      }

      const payload = {
        leave_type_id: parseInt(leaveTypeId),
        start_date: fromDate,
        end_date: toDate,
        half_day: halfDay,
        reason: reason.trim(),
        attachment_urls: uploadedFileUrls,
      };

      const updateRes = await apiFetch(`/leave/requests/${request.leave_request_id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (!updateRes.ok) {
        const errorData = await updateRes.json();
        throw new Error(errorData.detail || 'Failed to update request');
      }

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

            <div>
              <label className="block text-sm text-slate-500 mb-2">Attachments</label>
              
              <div 
                className={`border border-dashed rounded-md transition-colors cursor-pointer group relative mb-3 ${isDragging ? 'border-[#F2924E] bg-orange-50/50' : 'border-slate-300 bg-slate-50/50 hover:bg-slate-100/50'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) {
                    setNewAttachments(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
                  }
                }}
              >
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="py-8 px-4 text-center flex flex-col items-center">
                  <div className="w-10 h-10 bg-white border border-slate-100 rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <UploadCloud className="text-[#F2924E]" size={20} />
                  </div>
                  <p className="text-sm text-slate-600">Click or drag files to upload</p>
                </div>
              </div>

              {(existingUrls.length > 0 || newAttachments.length > 0) && (
                <div className="space-y-2">
                  {existingUrls.map((url, i) => (
                    <div key={`old-${i}`} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileIcon size={16} className="text-orange-400 flex-shrink-0" />
                        <span className="text-sm text-gray-600 truncate">{url.split('/').pop()} (previously uploaded)</span>
                      </div>
                      <button type="button" onClick={() => removeExistingFile(i)} className="text-gray-400 hover:text-red-500 p-1">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  {newAttachments.map((f, i) => (
                    <div key={`new-${i}`} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileIcon size={16} className="text-orange-500 flex-shrink-0" />
                        <span className="text-sm text-gray-900 truncate">{f.name}</span>
                      </div>
                      <button type="button" onClick={() => removeNewFile(i)} className="text-gray-400 hover:text-red-500 p-1">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
