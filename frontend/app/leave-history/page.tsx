'use client';

import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import LeaveTabs from '../components/LeaveTabs';
import { Search } from "lucide-react";
interface LeaveRequest {
  id: string;
  type: string;
  dateRange: string;
  totalDays: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  approver: string;
}

const mockLeaveRequests: LeaveRequest[] = [
  {
    id: 'LR-2024-0015',
    type: 'Medical Leave',
    dateRange: 'Aug 20, 2024 - Aug 22, 2024',
    totalDays: '3 days',
    status: 'Approved',
    approver: 'Naeemah Peters - HR Manager',
  },
  {
    id: 'LR-2024-0015',
    type: 'Casual Leave',
    dateRange: 'Sep 16, 2024 - Sep 18, 2024',
    totalDays: '3 days',
    status: 'Pending',
    approver: 'Naeemah Peters - HR Manager',
  },
  {
    id: 'LR-2024-1050',
    type: 'Annual Leave',
    dateRange: 'Oct 5, 2024 - Oct 7, 2024',
    totalDays: '3 days',
    status: 'Approved',
    approver: 'Naeemah Peters - HR Manager',
  },
  {
    id: 'LR-2024-1050',
    type: 'Short Leave',
    dateRange: 'Oct 20, 2024 - Oct 20, 2024',
    totalDays: '0.5 days',
    status: 'Rejected',
    approver: 'Naeemah Peters - HR Manager',
  },
];

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'Approved':
      return 'bg-orange-100 text-orange-600';
    case 'Pending':
      return 'bg-gray-200 text-gray-600';
    case 'Rejected':
      return 'bg-red-100 text-red-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

export default function LeaveHistoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [leaveType, setLeaveType] = useState('All type');
  const [status, setStatus] = useState('All Status');
  const [sortBy, setSortBy] = useState('Newest first');

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <TopBar />

      <div className="ml-64 pt-16">
        <main className="px-10 py-8 min-h-[calc(100vh-4rem)] overflow-auto">
          <LeaveTabs active="history" />

          <div className="mt-6">
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Leave History</h1>
            <p className="text-gray-600 mb-6">Review and manage pending leave requests</p>

            {/* Search and Filters */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                {/* Search */}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Search leave requests"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search size={16} />
                  </span>
                </div>

                {/* Leave Type Dropdown */}
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 cursor-pointer"
                >
                  <option>All type</option>
                  <option>Annual Leave</option>
                  <option>Casual Leave</option>
                  <option>Medical Leave</option>
                  <option>Short Leave</option>
                  <option>Sick Leave</option>
                </select>

                {/* Status Dropdown */}
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 cursor-pointer"
                >
                  <option>All Status</option>
                  <option>Approved</option>
                  <option>Pending</option>
                  <option>Rejected</option>
                </select>

                {/* Sort Dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 cursor-pointer"
                >
                  <option>Newest first</option>
                  <option>Oldest first</option>
                </select>
              </div>
            </div>

            {/* Table */}
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
                    {mockLeaveRequests.map((request, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-900">{request.id}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{request.type}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{request.dateRange}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{request.totalDays}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(request.status)}`}>
                            {request.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{request.approver}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

