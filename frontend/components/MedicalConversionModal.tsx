'use client';

import React, { useState } from 'react';
import { X, Stethoscope, Upload } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface LeaveLike {
  leave_request_id: number;
  start_date: string;
  end_date: string;
}

interface Props {
  request: LeaveLike;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MedicalConversionModal({ request, onClose, onSuccess }: Props) {
  const [startDate, setStartDate] = useState(request.start_date);
  const [endDate, setEndDate] = useState(request.end_date);
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addFiles = (list: FileList | null) => {
    if (list) setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  const submit = async () => {
    setError('');
    if (!startDate || !endDate) {
      setError('Please select the date range to reclassify.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date cannot be before start date.');
      return;
    }
    if (startDate < request.start_date || endDate > request.end_date) {
      setError('The selected range must fall within the original leave dates.');
      return;
    }
    if (files.length === 0) {
      setError('A medical document is required for reclassification.');
      return;
    }

    setSubmitting(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const up = await apiFetch('/leave/upload', { method: 'POST', body: fd });
        const upData = await up.json();
        if (!up.ok) throw new Error(upData.detail || `Failed to upload ${file.name}`);
        urls.push(upData.file_url);
      }

      const res = await apiFetch(
        `/leave/requests/${request.leave_request_id}/medical-conversion`,
        {
          method: 'POST',
          body: JSON.stringify({
            start_date: startDate,
            end_date: endDate,
            reason: reason || null,
            attachment_urls: urls,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to submit request');
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-4">
      <div className="relative w-full max-w-[520px] rounded-[20px] bg-white shadow-2xl">
        <button
          onClick={() => { if (!submitting) onClose(); }}
          className="absolute right-5 top-5 text-[#98A2B3] disabled:opacity-50"
          disabled={submitting}
        >
          <X size={22} />
        </button>

        <div className="p-6 pb-3 border-b border-[#F2F4F7]">
          <div className="flex items-center gap-2">
            <Stethoscope size={20} className="text-[#F2924E]" />
            <h2 className="text-[20px] font-bold text-[#1F2937]">Request Medical Reclassification</h2>
          </div>
          <p className="mt-1 text-[13px] text-[#667085]">
            Reclassify part of this approved Casual leave (LR-{request.leave_request_id}) as Medical.
            Your manager must approve it. Original allowed range:{' '}
            {request.start_date} – {request.end_date}.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#475467]">From</label>
              <input
                type="date"
                value={startDate}
                min={request.start_date}
                max={request.end_date}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-[10px] border border-[#D0D5DD] px-3 py-2 text-[14px] text-[#344054] focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-[13px] font-medium text-[#475467]">To</label>
              <input
                type="date"
                value={endDate}
                min={request.start_date}
                max={request.end_date}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-[10px] border border-[#D0D5DD] px-3 py-2 text-[14px] text-[#344054] focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#475467]">Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Fell sick during the leave."
              className="w-full resize-none rounded-[10px] border border-[#D0D5DD] px-3 py-2 text-[14px] text-[#344054] placeholder:text-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#475467]">
              Medical document <span className="text-red-500">*</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-dashed border-[#D0D5DD] bg-[#F9FAFB] px-3 py-3 text-[13px] text-[#667085] hover:bg-gray-50">
              <Upload size={16} className="text-[#F2924E]" />
              <span>Click to upload (PDF, JPG, PNG)</span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,application/pdf"
                className="sr-only"
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1 text-[13px] text-[#344054]">
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="text-[13px] font-medium text-red-600">{error}</p>}
        </div>

        <div className="p-6 pt-0 grid grid-cols-2 gap-3">
          <button
            onClick={submit}
            disabled={submitting}
            className="h-[46px] rounded-[12px] bg-[#F2924E] text-[15px] font-medium text-white disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="h-[46px] rounded-[12px] bg-[#98A2B3] text-[15px] font-medium text-white disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
