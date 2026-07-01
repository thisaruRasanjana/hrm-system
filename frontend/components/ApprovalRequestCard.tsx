'use client';

import React from 'react';
import {
  Building2,
  CalendarDays,
  Clock3,
  Paperclip,
  CircleUserRound,
  CheckCircle2,
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
    annual: string;
    casual: string;
  };
}

interface Props {
  request: ApprovalRequest;
  onReview: () => void;
}

export default function ApprovalRequestCard({ request, onReview }: Props) {
  return (
    <div className="rounded-[18px] border border-[#E4E7EC] bg-white p-4 shadow-sm">
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

      <div className="mt-4 space-y-3">
        <div className="flex items-start gap-2">
          <Building2 size={16} className="mt-0.5 text-[#667085]" />
          <div>
            <p className="text-[14px] text-[#344054]">{request.department}</p>
            <p className="text-[14px] text-[#667085]">{request.role}</p>
          </div>
        </div>

        <div>
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
      </div>

      <button
        onClick={onReview}
        className="mt-5 flex h-[42px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#667085] text-[16px] font-medium text-white"
      >
        <CheckCircle2 size={17} />
        Review
      </button>
    </div>
  );
}