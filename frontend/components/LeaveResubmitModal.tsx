'use client';

import React, { useState } from 'react';
import { X, UploadCloud, File as FileIcon, Loader2 } from 'lucide-react';
import { apiFetch } from "@/lib/api";
import LeaveDatePicker from './LeaveDatePicker';


interface LeaveRequest {
  leave_request_id: number;
  leave_type_name?: string | null;
  start_date: string;
  end_date: string;
  total_days: number;
  half_day: boolean;
  reason?: string | null;
  manager_comment?: string | null;
  status?: string;
}

interface LeaveResubmitModalProps {
  request: LeaveRequest;
  onClose: () => void;
  onSuccess: () => void;
}

export default function LeaveResubmitModal({
  request,
  onClose,
  onSuccess,
}: LeaveResubmitModalProps) {
  const [attachments, setAttachments] = useState<File[]>([]);
  const [reason, setReason] = useState('');
  const [dateSelection, setDateSelection] = useState({
    startDate: request.start_date,
    endDate: request.end_date,
    halfDay: request.half_day,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const requestId = request.leave_request_id;
  const managerComment = request.manager_comment;
  const isPendingMedical = request.status === 'PENDING_MEDICAL';

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

    if (attachments.length === 0 && !reason.trim()) {
      setError('Please provide a supporting medical report/document or a comment to resubmit.');
      return;
    }

    setIsSubmitting(true);

    try {
      let uploadedFileUrls: string[] = [];

      // Step 1: Upload new attachments if any
      if (attachments.length > 0) {
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
      }

      // Step 2: Call the resubmit patch endpoint
      const payload = {
        attachment_urls: uploadedFileUrls,
        reason: reason.trim() || undefined,
        start_date: dateSelection.startDate,
        end_date: dateSelection.endDate,
        half_day: dateSelection.halfDay,
      };

      const resubmitRes = await apiFetch(`/leave/requests/${requestId}/resubmit`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (!resubmitRes.ok) {
        const errorText = await resubmitRes.text();
        throw new Error(errorText || 'Failed to resubmit request');
      }

      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-[500px] rounded-[24px] bg-white shadow-2xl p-6 md:p-8 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-gray-900">
            {isPendingMedical ? 'Medical Docs Required' : 'Action Required'}
          </h2>
          <button
            onClick={() => !isSubmitting && onClose()}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {isPendingMedical
            ? `HR has requested supporting medical documentation for Leave Request LR-${requestId}.`
            : `HR has requested additional information for Leave Request LR-${requestId}.`}
        </p>

        {/* Request Details Summary Table */}
        <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-gray-50/30">
          <table className="w-full text-left text-xs">
            <tbody className="divide-y divide-gray-100">
              <tr>
                <th className="px-4 py-2 font-semibold text-gray-500 w-1/3">Type</th>
                <td className="px-4 py-2 font-medium text-gray-900">{request.leave_type_name || "-"}</td>
              </tr>
              <tr>
                <th className="px-4 py-2 font-semibold text-gray-500">Dates</th>
                <td className="px-4 py-2 font-medium text-gray-900">
                  <div className="w-[300px]">
                    <LeaveDatePicker
                      value={dateSelection}
                      onChange={setDateSelection}
                    />
                  </div>
                </td>
              </tr>
              {request.reason && (
                <tr>
                  <th className="px-4 py-2 font-semibold text-gray-500 align-top">Original Reason</th>
                  <td className="px-4 py-2 font-medium text-gray-900 italic break-words">"{request.reason}"</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
          
          {/* HR Comment Callout */}
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider block mb-1">
              HR message
            </span>
            <p className="text-sm text-orange-900 leading-relaxed font-medium">
              "{managerComment || 'Please provide correct documents or clarify your request.'}"
            </p>
          </div>

          {/* Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload New Documents (Optional)
            </label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer group relative">
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="py-8 px-4 text-center flex flex-col items-center">
                <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <UploadCloud className="text-orange-500" size={24} />
                </div>
                <p className="text-sm font-medium text-gray-700">Click to upload new files</p>
                <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (Max 5MB)</p>
              </div>
            </div>

            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileIcon size={16} className="text-orange-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{file.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reason Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Comments (Optional)
            </label>
            <textarea
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 resize-none"
              rows={3}
              placeholder="Clarify your leave request here..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded-lg border border-red-100">
              {error}
            </p>
          )}

          {/* Action Buttons */}
          <div className="pt-4 grid grid-cols-2 gap-3 pb-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-[#F2924E] hover:bg-orange-500 text-white font-medium rounded-xl transition-colors disabled:opacity-70 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Submitting
                </>
              ) : (
                'Resubmit Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
