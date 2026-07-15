'use client';

import React from 'react';
import {
  Building2,
  CalendarDays,
  Clock3,
  Paperclip,
  CircleUserRound,
  CheckCircle2,
  Stethoscope,
  UserCheck,
} from 'lucide-react';

export interface ApprovalRequest {
  id: number;
  employeeName: string;
  employeeCode: string;
  department: string;
  role: string;
  leaveType: string;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  durationText: string;
  hasAttachment: boolean;
  attachmentUrls: string[];
  appliedOn: string;
  reason: string;
  balances: {
    leave_type_name?: string;
    remaining?: number | string | null;
  }[];
  status: string;
  assignedByName?: string | null;
}

interface Props {
  request: ApprovalRequest;
  onReview: () => void;
}

export default function ApprovalRequestCard({ request, onReview }: Props) {
  const isPendingMedical = request.status === 'PENDING_MEDICAL';
  const isAssigned = !!request.assignedByName;
  // Note: 'isReportUploaded' removed — the existing isPendingMedical badge 
  // covers this flow. A plain attachment on a medical leave could be the 
  // original submission, not a post-PENDING_MEDICAL resubmit.
  const isReportUploaded = false;

  return (
    <div className={`rounded-[18px] border p-4 shadow-sm transition-all ${
      isPendingMedical 
        ? 'border-teal-200 bg-teal-50/40 hover:bg-teal-50/60' 
        : isReportUploaded 
          ? 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/50'
          : 'border-[#E4E7EC] bg-white hover:bg-gray-50/50'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F2F4F7]">
            <CircleUserRound size={22} className="text-[#667085]" />
          </div>

          <div>
            <h3 className="text-[16px] font-semibold text-[#1F2937]">
              {request.employeeName}
            </h3>
            <p className="text-[14px] text-[#98A2B3]">{request.employeeCode}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {isPendingMedical && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
              <Stethoscope size={13} />
              Pending Medical
            </span>
          )}

          {isReportUploaded && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200 animate-pulse">
              <CheckCircle2 size={13} />
              Report Uploaded
            </span>
          )}

          {isAssigned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700 border border-orange-200">
              <UserCheck size={12} />
              Assigned
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-start gap-2">
          <Building2 size={16} className="mt-0.5 text-[#667085]" />
          <div>
            <p className="text-[14px] text-[#344054]">{request.department}</p>
            <p className="text-[14px] text-[#667085]">{request.role}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full bg-[#F2924E] px-3 py-1 text-[13px] font-medium text-white">
            {request.leaveType}
          </span>
        </div>

        <div className="flex items-start gap-2">
          <CalendarDays size={16} className="mt-0.5 text-[#667085]" />
          <div>
            <p className="text-[14px] text-[#667085]">Date Range</p>
            <p className="text-[14px] text-[#344054]">
              {request.startDate} - {request.endDate}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Clock3 size={16} className="mt-0.5 text-[#667085]" />
          <div>
            <p className="text-[14px] text-[#667085]">Duration</p>
            <p className="text-[14px] text-[#344054]">{request.durationText}</p>
          </div>
        </div>

        {request.hasAttachment && (
          <div className="flex items-center gap-2">
            <Paperclip size={16} className="text-[#667085]" />
            <p className="text-[14px] text-[#344054]">Has attachment</p>
          </div>
        )}

        {isAssigned && request.assignedByName && (
          <div className="flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-100 px-2.5 py-1.5">
            <UserCheck size={14} className="text-orange-500 flex-shrink-0" />
            <div>
              <p className="text-[11px] text-orange-400 leading-none">Assigned by HR</p>
              <p className="text-[13px] font-medium text-orange-700">{request.assignedByName}</p>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onReview}
        className={`mt-5 flex h-[42px] w-full items-center justify-center gap-2 rounded-[12px] text-[16px] font-medium text-white transition-colors ${
          isPendingMedical 
            ? 'bg-teal-600 hover:bg-teal-700' 
            : isReportUploaded 
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-[#667085] hover:bg-slate-600'
        }`}
      >
        <CheckCircle2 size={17} />
        Review
      </button>
    </div>
  );
}