'use client';

import React, { useState } from 'react';
import { X, UploadCloud, File as FileIcon, Loader2 } from 'lucide-react';
import { apiFetch } from "@/lib/api";

interface LeaveRequest {
  leave_request_id: number;
  leave_type_name?: string | null;
  start_date: string;
  end_date: string;
  total_days: number;
  half_day: boolean;
  reason?: string | null;
}

interface MedicalConversionModalProps {
  request: LeaveRequest;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MedicalConversionModal({
  request,
  onClose,
  onSuccess,
}: MedicalConversionModalProps) {
  const [startDate, setStartDate] = useState(request.start_date);
  const [endDate, setEndDate] = useState(request.end_date);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
      setError('');
    }
  };

  const removeFile = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!startDate || !endDate) {
      setError('Start date and end date are required.');
      return;
    }

    if (new Date(startDate) < new Date(request.start_date) || new Date(endDate) > new Date(request.end_date)) {
      setError(`Reclassification dates must be within the original leave request dates: ${request.start_date} to ${request.end_date}.`);
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date cannot be after end_date.');
      return;
    }

    if (attachments.length === 0) {
      setError('Please upload at least one supporting medical document.');
      return;
    }

    setIsSubmitting(true);

    try {
      let uploadedFileUrls: string[] = [];

      // Step 1: Upload attachments
      for (const file of attachments) {
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

      // Step 2: Submit conversion request
      const payload = {
        start_date: startDate,
        end_date: endDate,
        attachment_urls: uploadedFileUrls,
        reason: reason.trim() || undefined,
      };

      const res = await apiFetch(`/leave/requests/${request.leave_request_id}/medical-conversion`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson?.detail || 'Failed to submit reclassification request.');
      }

      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-[500px] rounded-2xl bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
        >
          <X size={20} />
        </button>

        <h3 className="text-lg font-bold text-gray-900 mb-2">Request Medical Reclassification</h3>
        <p className="text-xs text-gray-500 mb-6">
          Request to change part or all of your approved Casual leave request (#{request.leave_request_id}) into Medical Leave. A medical document is required.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase">From Date</label>
              <input
                type="date"
                min={request.start_date}
                max={request.end_date}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] text-gray-700 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase">To Date</label>
              <input
                type="date"
                min={request.start_date}
                max={request.end_date}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] text-gray-700 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">
              Reason / Medical Details
            </label>
            <textarea
              placeholder="Provide a reason for the medical reclassification..."
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] text-gray-700 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-200 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1.5">
              Medical Documents
            </label>
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-4 text-center">
              <input
                type="file"
                multiple
                id="modal-file-upload"
                onChange={handleFileChange}
                className="hidden"
                accept="image/jpeg,image/png,application/pdf"
              />
              <label htmlFor="modal-file-upload" className="cursor-pointer flex flex-col items-center">
                <UploadCloud className="text-gray-400 mb-1" size={24} />
                <span className="text-[13px] font-medium text-orange-600">Click to upload file</span>
                <span className="text-[11px] text-gray-400 mt-0.5">JPEG, PNG, PDF up to 5MB</span>
              </label>
            </div>

            {attachments.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-100 p-2 bg-white text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{file.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-red-500 hover:text-red-700 font-medium"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-xs font-medium border border-red-100">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-medium text-white hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
