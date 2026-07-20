'use client';

import React, { useEffect, useState } from 'react';
import LeaveTabs from '@/components/LeaveTabs';
import LeaveResubmitModal from '@/components/LeaveResubmitModal';
import EditLeaveModal from '@/components/EditLeaveModal';
import MedicalConversionModal from '@/components/MedicalConversionModal';
import LeaveTypeBadge from '@/components/LeaveTypeBadge';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import { Search, Pencil, Trash2, Stethoscope, XCircle } from "lucide-react";
import { apiFetch } from '@/lib/api';
import toast from 'react-hot-toast';

interface LeaveType {
  id: number;
  name: string;
}


interface LeaveRequest {
  leave_request_id: number;
  employee_id: number;
  leave_type_id: number;
  leave_type_name?: string | null;
  start_date: string;
  end_date: string;
  total_days: number;
  half_day: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REQ_INFO' | 'PENDING_MEDICAL';
  reason?: string | null;
  attachment_urls?: string[];
  rejection_reason?: string | null;
  manager_comment?: string | null;
  approved_by?: number | null;
  approved_date?: string | null;
  parent_request_id?: number | null;
  approved_by_name?: string | null;
  created_at?: string | null;
}



const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'APPROVED':
      return 'bg-orange-100 text-orange-600';
    case 'PENDING':
      return 'bg-gray-200 text-gray-600';
    case 'REJECTED':
      return 'bg-red-100 text-red-600';
    case 'REQ_INFO':
      return 'bg-yellow-100 text-yellow-700';
    case 'PENDING_MEDICAL':
      return 'bg-teal-100 text-teal-700 border border-teal-200';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};



const leaveTypeIdMap: Record<string, string> = {
  'Annual Leave': '1',
  'Medical Leave': '2',
  'Casual Leave': '3',
  'Short Leave': '4',
};

export default function LeaveHistoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [leaveType, setLeaveType] = useState('All type');
  const [status, setStatus] = useState('All Status');
  const [sortBy, setSortBy] = useState('Newest first');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequestForInfo, setSelectedRequestForInfo] = useState<LeaveRequest | null>(null);
  const [selectedRequestForEdit, setSelectedRequestForEdit] = useState<LeaveRequest | null>(null);
  const [selectedRequestForConversion, setSelectedRequestForConversion] = useState<LeaveRequest | null>(null);
  const [requestToDelete, setRequestToDelete] = useState<number | null>(null);

  const fetchLeaveHistory = React.useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      if (leaveType !== "All type" && leaveTypeIdMap[leaveType]) {
        params.append("leave_type_id", leaveTypeIdMap[leaveType]);
      }

      if (status !== "All Status") {
        let backendStatus = status.toUpperCase();
        if (backendStatus === "ACTION REQUIRED") {
          backendStatus = "REQ_INFO";
        } else if (backendStatus === "MEDICAL DOCS REQUIRED") {
          backendStatus = "PENDING_MEDICAL";
        }
        params.append("status", backendStatus);
      }

      params.append("sort_by", sortBy === "Newest first" ? "newest" : "oldest");
      params.append("page", currentPage.toString());
      params.append("page_size", pageSize.toString());

      const url = `/leave/history/me?${params.toString()}`;

      const response = await apiFetch(url, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to fetch leave history");
      }

      const data = await response.json();
      console.log("Leave history response:", data);
      setLeaveRequests(data);
    } catch (error) {
      console.error("Error fetching leave history:", error);
      setLeaveRequests([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, leaveType, status, sortBy, currentPage]);

  const fetchLeaveTypes = async () => {
    try {
      const res = await apiFetch("/leave/types");
      if (res.ok) {
        const data = await res.json();
        setLeaveTypes(data);
      }
    } catch (err) {
      console.error("Failed to fetch leave types", err);
    }
  };

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  useEffect(() => {
    fetchLeaveHistory();
  }, [fetchLeaveHistory]);

  const handleCancel = async (requestId: number) => {
    const reason = window.prompt("Reason for cancellation:");
    if (reason !== null) {
      if (!reason.trim()) {
        alert("Cancellation reason is required.");
        return;
      }
      try {
        const res = await apiFetch(`/leave/requests/${requestId}/cancel`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason.trim() })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Failed to cancel leave request");
        }
        fetchLeaveHistory();
      } catch (err: any) {
        console.error("Error cancelling request", err);
        alert(err.message || "Could not cancel request. Please try again.");
      }
    }
  };


  const confirmDelete = async () => {
    if (!requestToDelete) return;
    try {
      const res = await apiFetch(`/leave/requests/${requestToDelete}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error("Failed to delete leave request");
      setSelectedRequestForEdit(null);
      setRequestToDelete(null);
      toast.success("Leave request deleted successfully.");
      fetchLeaveHistory();
    } catch (err) {
      console.error("Error deleting request", err);
      toast.error("Could not delete request. Please try again.");
    }
  };

  const handleDelete = (requestId: number) => {
    setRequestToDelete(requestId);
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };


  return (
    <div>
      <LeaveTabs />

          <div className="mt-6">
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Leave History</h1>
            <p className="text-gray-600 mb-6">Review and manage pending leave requests</p>


            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex flex-row gap-4 items-center">
                <div className="relative flex-[2] min-w-0">
                  <input
                    type="text"
                    placeholder="Search leave requests"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-400 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search size={16} />
                  </span>
                </div>

                <select
                  value={leaveType}
                  onChange={(e) => { setLeaveType(e.target.value); setCurrentPage(1); }}
                  className="flex-1 min-w-[160px] px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 cursor-pointer"
                >
                  <option>All type</option>
                  {leaveTypes.map(lt => (
                    <option key={lt.id} value={lt.id.toString()}>{lt.name}</option>
                  ))}
                </select>

                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="flex-1 min-w-[160px] px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 cursor-pointer"
                >
                  <option>All Status</option>
                  <option>Approved</option>
                  <option>Pending</option>
                  <option>Rejected</option>
                  <option>Action Required</option>
                  <option>Medical Docs Required</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="flex-1 min-w-[160px] px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 cursor-pointer"
                >
                  <option>Newest first</option>
                  <option>Oldest first</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        REQUEST ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        LEAVE TYPE
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        REQUEST DATE
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        DATE RANGE
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        TOTAL DAYS
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        STATUS
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        APPROVER
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                          Loading leave history...
                        </td>
                      </tr>
                    ) : leaveRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                          No leave history found
                        </td>
                      </tr>
                    ) : (
                      leaveRequests.map((request) => (
                        <tr key={request.leave_request_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-900">
                            LR-{request.leave_request_id}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            <div className="flex items-center gap-2">
                              {request.leave_type_name ? <LeaveTypeBadge name={request.leave_type_name} /> : '-'}
                              {request.parent_request_id && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-orange-100 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-600">
                                  <Stethoscope size={11} /> To Medical
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                            {request.created_at ? new Date(request.created_at).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '--'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {formatDate(request.start_date)} - {formatDate(request.end_date)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {request.half_day ? '0.5 days' : `${request.total_days} days`}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {request.status === 'REQ_INFO' || request.status === 'PENDING_MEDICAL' ? (
                              <button
                                onClick={() => setSelectedRequestForInfo(request)}
                                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer shadow-sm animate-pulse ${
                                  request.status === 'PENDING_MEDICAL'
                                    ? 'bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200'
                                    : 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200'
                                }`}
                              >
                                {request.status === 'PENDING_MEDICAL' ? 'Upload Medical' : 'Action Req'}
                              </button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(request.status)}`}>
                                  {request.status}
                                </span>
                                {request.status === 'PENDING' && (
                                  <div className="flex items-center gap-1 ml-1 opacity-80 hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => setSelectedRequestForEdit(request)}
                                      title="Edit pending request"
                                      className="p-1.5 hover:bg-gray-200 rounded-md text-gray-500 hover:text-blue-600 transition-colors"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                  </div>
                                )}
                                {request.status === 'APPROVED' &&
                                  new Date(request.start_date).setHours(0,0,0,0) > new Date().setHours(0,0,0,0) && (
                                    <button
                                      onClick={() => handleCancel(request.leave_request_id)}
                                      title="Cancel approved leave"
                                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100 transition-colors ml-1"
                                    >
                                      <XCircle size={12} /> Cancel
                                    </button>
                                  )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {request.approved_by_name ?? request.approved_by ?? '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Page {currentPage}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={leaveRequests.length < pageSize}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>

      {selectedRequestForInfo && (
        <LeaveResubmitModal
          request={selectedRequestForInfo}
          onClose={() => setSelectedRequestForInfo(null)}
          onSuccess={() => {
            setSelectedRequestForInfo(null);
            fetchLeaveHistory();
          }}
        />
      )}

      {selectedRequestForEdit && (
        <EditLeaveModal
          request={selectedRequestForEdit}
          onClose={() => setSelectedRequestForEdit(null)}
          onSuccess={() => {
            setSelectedRequestForEdit(null);
            fetchLeaveHistory();
          }}
          onDelete={() => handleDelete(selectedRequestForEdit.leave_request_id)}
        />
      )}

      {selectedRequestForConversion && (
        <MedicalConversionModal
          request={selectedRequestForConversion}
          onClose={() => setSelectedRequestForConversion(null)}
          onSuccess={() => {
            setSelectedRequestForConversion(null);
            fetchLeaveHistory();
          }}
        />
      )}

      {requestToDelete !== null && (
        <ConfirmDeleteModal
          onClose={() => setRequestToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}