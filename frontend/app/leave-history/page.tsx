'use client';

import React, { useEffect, useState } from 'react';
import LeaveTabs from '@/components/LeaveTabs';
import LeaveResubmitModal from '@/components/LeaveResubmitModal';
import EditLeaveModal from '@/components/EditLeaveModal';
import { Search, Pencil, Trash2 } from "lucide-react";
import { apiFetch } from '@/lib/api';

interface LeaveRequest {
  leave_request_id: number;
  employee_id: number;
  leave_type_id: number;
  leave_type_name?: string | null;
  start_date: string;
  end_date: string;
  total_days: number;
  half_day: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REQ_INFO';
  reason?: string | null;
  attachment_urls?: string[];
  rejection_reason?: string | null;
  manager_comment?: string | null;
  approved_by?: number | null;
  approved_date?: string | null;
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

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequestForInfo, setSelectedRequestForInfo] = useState<LeaveRequest | null>(null);
  const [selectedRequestForEdit, setSelectedRequestForEdit] = useState<LeaveRequest | null>(null);

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
        }
        params.append("status", backendStatus);
      }

      params.append("sort_by", sortBy === "Newest first" ? "newest" : "oldest");

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
  }, [searchTerm, leaveType, status, sortBy, leaveTypeIdMap]);

  useEffect(() => {
    fetchLeaveHistory();
  }, [fetchLeaveHistory]);

  const handleDelete = async (requestId: number) => {
    if (window.confirm("Are you sure you want to cancel and delete this pending request?")) {
      try {
        const res = await apiFetch(`/leave/requests/${requestId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error("Failed to delete leave request");
        setSelectedRequestForEdit(null); // safely close the modal if open
        fetchLeaveHistory();
      } catch (err) {
        console.error("Error deleting request", err);
        alert("Could not delete request. Please try again.");
      }
    }
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
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="flex-1 min-w-[160px] px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 cursor-pointer"
                >
                  <option>All type</option>
                  <option>Annual Leave</option>
                  <option>Casual Leave</option>
                  <option>Medical Leave</option>
                  <option>Short Leave</option>
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
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                          Loading leave history...
                        </td>
                      </tr>
                    ) : leaveRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
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
                            {request.leave_type_name || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {formatDate(request.start_date)} - {formatDate(request.end_date)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {request.half_day ? '0.5 days' : `${request.total_days} days`}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {request.status === 'REQ_INFO' ? (
                              <button
                                onClick={() => setSelectedRequestForInfo(request)}
                                className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 transition-colors cursor-pointer shadow-sm animate-pulse"
                              >
                                Action Req
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
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {request.approved_by ?? '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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
    </div>
  );
}