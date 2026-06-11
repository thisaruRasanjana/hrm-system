'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import LeaveTabs from '../../components/LeaveTabs';
import ApprovalRequestCard, {
  ApprovalRequest,
} from '../../components/ApprovalRequestCard';
import ApprovalReviewModal, {
  ModalMode,
} from '../../components/ApprovalReviewModal';
import { Search, ChevronDown, CheckCircle2, XCircle } from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../lib/api';

type BackendLeaveRequest = {
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
  attachment_urls?: string[] | null;
  rejection_reason?: string | null;
  manager_comment?: string | null;
  approved_by?: number | null;
  approved_date?: string | null;
};

type PendingRequestsResponse =
  | BackendLeaveRequest[]
  | {
      items?: BackendLeaveRequest[];
      data?: BackendLeaveRequest[];
      results?: BackendLeaveRequest[];
    };

function formatDate(dateString: string) {
  if (!dateString) return '--';

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? `${dateString}T00:00:00`
    : dateString;

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return '--';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
  });
}

function mapBackendToFrontend(item: BackendLeaveRequest): ApprovalRequest {
  const urls = Array.isArray(item.attachment_urls) ? item.attachment_urls : [];
  return {
    id: item.leave_request_id,
    employeeName: `Employee ${item.employee_id}`,
    employeeCode: `EMP_${String(item.employee_id).padStart(2, '0')}`,
    department: 'Department',
    role: 'Employee',
    leaveType: item.leave_type_name || `Leave Type ${item.leave_type_id}`,
    startDate: formatDate(item.start_date),
    endDate: formatDate(item.end_date),
    durationText: item.half_day ? '0.5 Days' : `${item.total_days} Days`,
    hasAttachment: urls.length > 0,
    attachmentUrls: urls,
    appliedOn: item.start_date,
    reason: item.reason || 'No reason provided',
    balances: {
      annual: '--',
      casual: '--',
    },
  };
}

function extractRequestList(payload: PendingRequestsResponse): BackendLeaveRequest[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

async function parseErrorResponse(response: Response): Promise<string> {
  const fallback = `Request failed (${response.status} ${response.statusText})`;

  try {
    const text = await response.text();
    if (!text) return fallback;

    try {
      const json = JSON.parse(text);
      if (typeof json?.detail === 'string') return json.detail;
      if (typeof json?.message === 'string') return json.message;
      return text;
    } catch {
      return text;
    }
  } catch {
    return fallback;
  }
}

export default function ApprovalPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('All type');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [sortBy, setSortBy] = useState('sort by');

  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>('review');

  const [actionMessage, setActionMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [role, setRole] = useState<string | null | undefined>(undefined);

  const router = useRouter();

  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    setRole(storedRole);
  }, []);

  useEffect(() => {
    if (role === undefined) return;

    if (role !== 'hr') {
      router.replace('/apply-leave');
    }
  }, [role, router]);

  const loadPendingRequests = useCallback(async () => {
    try {
      setLoading(true);
      setActionMessage('');
      setMessageType('');

      const response = await fetch(`${API_BASE_URL}/leave/requests/pending`, {
        method: 'GET',
        headers: getAuthHeaders(),
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage || 'Failed to load pending leave requests');
      }

      const payload: PendingRequestsResponse = await response.json();
      const items = extractRequestList(payload);
      setRequests(items.map(mapBackendToFrontend));
    } catch (error) {
      console.error('loadPendingRequests error:', error);
      setRequests([]);
      setActionMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load pending leave requests.'
      );
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role === 'hr') {
      loadPendingRequests();
    }
  }, [role, loadPendingRequests]);

  useEffect(() => {
    if (!actionMessage) return;

    const timer = setTimeout(() => {
      setActionMessage('');
      setMessageType('');
    }, 3000);

    return () => clearTimeout(timer);
  }, [actionMessage]);

  const filteredRequests = useMemo(() => {
    let data = [...requests];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      data = data.filter(
        (item) =>
          item.employeeName.toLowerCase().includes(q) ||
          item.employeeCode.toLowerCase().includes(q) ||
          item.department.toLowerCase().includes(q) ||
          item.role.toLowerCase().includes(q) ||
          item.leaveType.toLowerCase().includes(q)
      );
    }

    if (leaveTypeFilter !== 'All type') {
      data = data.filter((item) => item.leaveType === leaveTypeFilter);
    }

    if (departmentFilter !== 'All Departments') {
      data = data.filter((item) => item.department === departmentFilter);
    }

    if (sortBy === 'Name') {
      data.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    }

    return data;
  }, [requests, searchTerm, leaveTypeFilter, departmentFilter, sortBy]);

  const openReview = async (request: ApprovalRequest) => {
    try {
      const response = await fetch(`${API_BASE_URL}/leave/requests/${request.id}`, {
        method: 'GET',
        headers: getAuthHeaders(),
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage || 'Failed to load leave request details');
      }

      const data: BackendLeaveRequest = await response.json();
      setSelectedRequest(mapBackendToFrontend(data));
      setModalMode('review');
    } catch (error) {
      console.error('openReview error:', error);
      setActionMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load leave request details.'
      );
      setMessageType('error');
    }
  };

  const closeModal = () => {
    setSelectedRequest(null);
    setModalMode('review');
  };

  const handleApprove = async (comment: string) => {
    if (!selectedRequest) return;

    try {
      setActionLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/leave/requests/${selectedRequest.id}/approve`,
        {
          method: 'PATCH',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            manager_comment: comment || null,
          }),
        }
      );

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage || 'Failed to approve leave request');
      }

      setActionMessage('Leave request approved successfully.');
      setMessageType('success');
      closeModal();
      await loadPendingRequests();
    } catch (error) {
      console.error('handleApprove error:', error);
      setActionMessage(
        error instanceof Error ? error.message : 'Failed to approve leave request.'
      );
      setMessageType('error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!selectedRequest) return;

    try {
      setActionLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/leave/requests/${selectedRequest.id}/reject`,
        {
          method: 'PATCH',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rejection_reason: reason,
          }),
        }
      );

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage || 'Failed to reject leave request');
      }

      setActionMessage('Leave request rejected successfully.');
      setMessageType('success');
      closeModal();
      await loadPendingRequests();
    } catch (error) {
      console.error('handleReject error:', error);
      setActionMessage(
        error instanceof Error ? error.message : 'Failed to reject leave request.'
      );
      setMessageType('error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestInfo = async (message: string) => {
    if (!selectedRequest) return;

    try {
      setActionLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/leave/requests/${selectedRequest.id}/request-info`,
        {
          method: 'PATCH',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            manager_comment: message,
          }),
        }
      );

      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage || 'Failed to send info request');
      }

      setActionMessage('Additional information request sent successfully.');
      setMessageType('success');
      closeModal();
      await loadPendingRequests();
    } catch (error) {
      console.error('handleRequestInfo error:', error);
      setActionMessage(
        error instanceof Error ? error.message : 'Failed to send info request.'
      );
      setMessageType('error');
    } finally {
      setActionLoading(false);
    }
  };

  if (role === undefined) {
    return null;
  }

  if (role !== 'hr') {
    return <div className="p-10 text-red-500 font-semibold">Access Denied</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <TopBar />

      <div className="ml-64 pt-16">
        <main className="px-10 pt-4 pb-8 min-h-[calc(100vh-4rem)] overflow-auto">
          <LeaveTabs />

          <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[24px] font-bold leading-tight text-[#1F2937]">
                Approval Panel
              </h1>
              <p className="mt-1 text-[16px] text-[#667085]">
                Review and manage pending leave requests
              </p>
            </div>

            <div className="flex h-[46px] items-center rounded-[14px] bg-[#FFF2E3] px-5">
              <span className="mr-2 text-[18px] font-bold text-[#F2924E]">
                {filteredRequests.length}
              </span>
              <span className="text-[16px] text-[#F2924E]">Pending Requests</span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="relative w-full max-w-[360px]">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#98A2B3]"
              />
              <input
                type="text"
                placeholder="Search leave requests"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-[48px] w-full rounded-[14px] border border-[#E4E7EC] bg-white pl-11 pr-4 text-[15px] text-[#344054] placeholder:text-[#98A2B3] focus:outline-none"
              />
            </div>

            <div className="relative w-[150px]">
              <select
                value={leaveTypeFilter}
                onChange={(e) => setLeaveTypeFilter(e.target.value)}
                className="h-[48px] w-full appearance-none rounded-[14px] border border-[#E4E7EC] bg-white px-4 pr-10 text-[15px] text-[#344054] focus:outline-none"
              >
                <option>All type</option>
                {[...new Set(requests.map((r) => r.leaveType))].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
              <ChevronDown
                size={18}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#667085]"
              />
            </div>

            <div className="relative w-[180px]">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="h-[48px] w-full appearance-none rounded-[14px] border border-[#E4E7EC] bg-white px-4 pr-10 text-[15px] text-[#344054] focus:outline-none"
              >
                <option>All Departments</option>
                {[...new Set(requests.map((r) => r.department))].map((dept) => (
                  <option key={dept}>{dept}</option>
                ))}
              </select>
              <ChevronDown
                size={18}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#667085]"
              />
            </div>

            <div className="relative ml-auto w-[140px]">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-[48px] w-full appearance-none rounded-[14px] border border-[#E4E7EC] bg-white px-4 pr-10 text-[15px] text-[#344054] focus:outline-none"
              >
                <option>sort by</option>
                <option>Name</option>
              </select>
              <ChevronDown
                size={18}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#667085]"
              />
            </div>
          </div>

          {actionMessage && (
            <div
              className={`mt-5 flex items-center gap-3 rounded-[14px] border px-4 py-3 text-[15px] font-medium ${
                messageType === 'success'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {messageType === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              <span>{actionMessage}</span>
            </div>
          )}

          {loading ? (
            <div className="mt-8 rounded-[14px] bg-white p-6 text-[16px] text-[#667085] shadow-sm">
              Loading pending leave requests...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="mt-8 rounded-[14px] bg-white p-6 text-[16px] text-[#667085] shadow-sm">
              No pending leave requests found.
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              {filteredRequests.map((request) => (
                <ApprovalRequestCard
                  key={request.id}
                  request={request}
                  onReview={() => openReview(request)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {selectedRequest && (
        <ApprovalReviewModal
          request={selectedRequest}
          mode={modalMode}
          onClose={closeModal}
          onApprove={() => setModalMode('approve')}
          onReject={() => setModalMode('reject')}
          onReqInfo={() => setModalMode('info')}
          onCancelAction={() => setModalMode('review')}
          onConfirmApprove={handleApprove}
          onConfirmReject={handleReject}
          onSendInfoRequest={handleRequestInfo}
        />
      )}

      {actionLoading && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/20">
          <div className="rounded-[14px] bg-white px-6 py-4 text-[16px] font-medium text-[#344054] shadow-lg">
            Processing...
          </div>
        </div>
      )}
    </div>
  );
}