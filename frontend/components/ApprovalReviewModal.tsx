'use client';

import React, { useEffect, useState } from 'react';
import { X, CircleUserRound, Building2, Check, Info, Paperclip, ExternalLink, FileText, Image } from 'lucide-react';
import { ApprovalRequest } from './ApprovalRequestCard';
import { API_BASE_URL } from '@/lib/constants';

export type ModalMode = 'review' | 'approve' | 'reject' | 'info';

interface Props {
  request: ApprovalRequest;
  mode: ModalMode;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReqInfo: () => void;
  onCancelAction: () => void;
  onConfirmApprove: (comment: string) => void;
  onConfirmReject: (reason: string) => void;
  onSendInfoRequest: (message: string) => void;
  isSubmitting?: boolean;
}

export default function ApprovalReviewModal({
  request,
  mode,
  onClose,
  onApprove,
  onReject,
  onReqInfo,
  onCancelAction,
  onConfirmApprove,
  onConfirmReject,
  onSendInfoRequest,
  isSubmitting = false,
}: Props) {
  const [approveComment, setApproveComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setApproveComment('');
    setRejectReason('');
    setInfoMessage('');
    setValidationError('');
  }, [mode, request]);

  const handleApproveSubmit = () => {
    if (isSubmitting) return;
    onConfirmApprove(approveComment.trim());
  };

  const handleRejectSubmit = () => {
    const trimmedReason = rejectReason.trim();
    if (!trimmedReason) {
      setValidationError('Rejection reason is required.');
      return;
    }
    if (isSubmitting) return;
    setValidationError('');
    onConfirmReject(trimmedReason);
  };

  const handleInfoSubmit = () => {
    const trimmedMessage = infoMessage.trim();
    if (!trimmedMessage) {
      setValidationError('Please enter the required information message.');
      return;
    }
    if (isSubmitting) return;
    setValidationError('');
    onSendInfoRequest(trimmedMessage);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-4">
      <div className="relative w-full max-w-[760px] rounded-[20px] bg-white shadow-2xl flex flex-col max-h-[90vh]">

        {/* ── Fixed header ── */}
        <div className="p-5 md:p-6 pb-4 flex-shrink-0 border-b border-[#F2F4F7]">
          <button
            onClick={() => { if (!isSubmitting) onClose(); }}
            disabled={isSubmitting}
            className="absolute right-5 top-5 text-[#98A2B3] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={24} />
          </button>
          <h2 className="text-[22px] font-bold text-[#1F2937]">Leave Request Review</h2>
          <p className="mt-1 text-[14px] text-[#667085]">
            Review the details and take action on this leave request.
          </p>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-5 md:px-6 py-5 space-y-6">

          {/* Employee info */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F2F4F7]">
                <CircleUserRound size={24} className="text-[#667085]" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <h3 className="text-[18px] font-semibold text-[#1F2937]">{request.employeeName}</h3>
                  <span className="text-[14px] text-[#98A2B3]">{request.employeeCode}</span>
                </div>
                <div className="mt-1 flex items-start gap-2">
                  <Building2 size={14} className="mt-1 text-[#667085]" />
                  <div>
                    <p className="text-[14px] text-[#475467]">{request.department}</p>
                    <p className="text-[14px] text-[#667085]">{request.role}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="min-w-[205px]">
              <p className="mb-2 text-center text-[14px] text-[#667085]">Current Balance</p>
              <div className="flex gap-2">
                <div className="rounded-md bg-[#FFF7ED] px-3 py-2 text-center">
                  <p className="text-[14px] text-[#6B7280]">Annual Leaves</p>
                  <p className="text-[16px] font-bold text-[#1F2937]">{request.balances.annual}</p>
                </div>
                <div className="rounded-md bg-[#FFF7ED] px-3 py-2 text-center">
                  <p className="text-[14px] text-[#6B7280]">Casual Leaves</p>
                  <p className="text-[16px] font-bold text-[#1F2937]">{request.balances.casual}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Leave details */}
          <div>
            <h4 className="text-[18px] font-bold text-[#1F2937] mb-4">Leave Request Details</h4>
            <div className="space-y-4">
              <DetailRow
                label="Leave Type"
                value={
                  <span className="inline-flex rounded-full bg-[#F2924E] px-4 py-1 text-[14px] font-medium text-white">
                    {request.leaveType}
                  </span>
                }
              />
              <DetailRow
                label="Period"
                value={<span>{request.startDate} - {request.endDate}</span>}
              />
              <DetailRow
                label="Total Duration"
                value={<span className="font-semibold text-[#F2924E]">{request.durationText}</span>}
              />
              <DetailRow label="Applied On" value={<span>{request.appliedOn}</span>} />
              <DetailRow label="Reason" value={<span>{request.reason}</span>} />

              {/* Attachments */}
              {request.attachmentUrls && request.attachmentUrls.length > 0 && (
                <div className="grid grid-cols-[120px_1fr] gap-3">
                  <p className="text-[16px] text-[#475467] flex items-center gap-1">
                    <Paperclip size={14} />
                    Attachments :
                  </p>
                  <div className="flex flex-col gap-2">
                    {request.attachmentUrls.map((url, idx) => {
                      const fullUrl = url.startsWith('http')
                        ? url
                        : `${API_BASE_URL}${url}`;
                      const filename = url.split('/').pop() || `file-${idx + 1}`;
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
                      const isPdf = /\.pdf$/i.test(filename);

                      return (
                        <div
                          key={idx}
                          className="rounded-[10px] border border-[#E4E7EC] bg-[#F9FAFB] p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              {isImage ? (
                                <Image size={16} className="text-[#F2924E] flex-shrink-0" />
                              ) : isPdf ? (
                                <FileText size={16} className="text-red-500 flex-shrink-0" />
                              ) : (
                                <Paperclip size={16} className="text-[#667085] flex-shrink-0" />
                              )}
                              <span className="text-[13px] text-[#344054] truncate">{filename}</span>
                            </div>
                            <a
                              href={fullUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 flex-shrink-0 rounded-md bg-[#F2924E] px-2.5 py-1 text-[12px] font-medium text-white hover:bg-orange-600 transition-colors"
                            >
                              <ExternalLink size={12} />
                              Open
                            </a>
                          </div>

                          {isImage && (
                            <div className="mt-2 rounded-md overflow-hidden border border-[#E4E7EC]">
                              <img
                                src={fullUrl}
                                alt={filename}
                                className="w-full max-h-48 object-contain bg-white"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Conditional action textareas */}
          {mode === 'approve' && (
            <div>
              <label className="mb-3 block text-[16px] text-[#1F2937]">Comments (Optional)</label>
              <textarea
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                placeholder="Add any comment about this approval."
                disabled={isSubmitting}
                className="h-[112px] w-full resize-none rounded-[14px] border border-[#D0D5DD] bg-[#F9FAFB] px-4 py-3 text-[15px] text-[#344054] placeholder:text-[#98A2B3] focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>
          )}

          {mode === 'reject' && (
            <div>
              <label className="mb-3 block text-[16px] text-[#1F2937]">Rejection Reason</label>
              <textarea
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  if (validationError) setValidationError('');
                }}
                placeholder="Please provide a clear reason for rejection."
                disabled={isSubmitting}
                className="h-[112px] w-full resize-none rounded-[14px] border border-[#D0D5DD] bg-[#F9FAFB] px-4 py-3 text-[15px] text-[#344054] placeholder:text-[#98A2B3] focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>
          )}

          {mode === 'info' && (
            <div>
              <label className="mb-3 block text-[16px] text-[#1F2937]">What information do you need?</label>
              <textarea
                value={infoMessage}
                onChange={(e) => {
                  setInfoMessage(e.target.value);
                  if (validationError) setValidationError('');
                }}
                placeholder="Specify what additional information you need."
                disabled={isSubmitting}
                className="h-[112px] w-full resize-none rounded-[14px] border border-[#D0D5DD] bg-[#F9FAFB] px-4 py-3 text-[15px] text-[#344054] placeholder:text-[#98A2B3] focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>
          )}

          {validationError && (mode === 'reject' || mode === 'info') && (
            <p className="text-[14px] font-medium text-red-600">{validationError}</p>
          )}

        </div>{/* end scrollable body */}

        {/* ── Fixed footer: action buttons ── */}
        <div className="px-5 md:px-6 py-4 border-t border-[#F2F4F7] flex-shrink-0">
          {mode === 'review' && (
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={onApprove}
                disabled={isSubmitting}
                className="flex h-[48px] items-center justify-center gap-2 rounded-[12px] bg-[#F2924E] text-[16px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Check size={18} />
                Approve
              </button>
              <button
                onClick={onReject}
                disabled={isSubmitting}
                className="flex h-[48px] items-center justify-center gap-2 rounded-[12px] bg-[#98A2B3] text-[16px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                <X size={18} />
                Reject
              </button>
              <button
                onClick={onReqInfo}
                disabled={isSubmitting}
                className="flex h-[48px] items-center justify-center gap-2 rounded-[12px] border border-[#D0D5DD] bg-white text-[16px] font-medium text-[#344054] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Info size={18} />
                Req Info
              </button>
            </div>
          )}

          {mode === 'approve' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleApproveSubmit}
                disabled={isSubmitting}
                className="h-[48px] rounded-[12px] bg-[#F2924E] text-[16px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? 'Processing...' : 'Confirm Approval'}
              </button>
              <button
                onClick={onCancelAction}
                disabled={isSubmitting}
                className="h-[48px] rounded-[12px] bg-[#98A2B3] text-[16px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancel
              </button>
            </div>
          )}

          {mode === 'reject' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleRejectSubmit}
                disabled={isSubmitting}
                className="h-[48px] rounded-[12px] bg-[#F2924E] text-[16px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? 'Processing...' : 'Confirm Rejection'}
              </button>
              <button
                onClick={onCancelAction}
                disabled={isSubmitting}
                className="h-[48px] rounded-[12px] bg-[#98A2B3] text-[16px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancel
              </button>
            </div>
          )}

          {mode === 'info' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleInfoSubmit}
                disabled={isSubmitting}
                className="h-[48px] rounded-[12px] bg-[#F2924E] text-[16px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? 'Processing...' : 'Send Request'}
              </button>
              <button
                onClick={onCancelAction}
                disabled={isSubmitting}
                className="h-[48px] rounded-[12px] bg-[#98A2B3] text-[16px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancel
              </button>
            </div>
          )}
        </div>{/* end footer */}

      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <p className="text-[16px] text-[#475467]">{label} :</p>
      <div className="text-[16px] text-[#1F2937]">{value}</div>
    </div>
  );
}