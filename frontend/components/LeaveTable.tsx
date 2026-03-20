import React from 'react';

export interface LeaveRecord {
  id: number;
  type: string;
  from: string; // yyyy-mm-dd
  to: string;
  days: number;
  status: 'Pending' | 'Approved' | 'Rejected';
}

interface LeaveTableProps {
  records: LeaveRecord[];
}

const statusColor = (status: string) => {
  switch (status) {
    case 'Pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'Approved':
      return 'bg-green-100 text-green-800';
    case 'Rejected':
      return 'bg-red-100 text-red-800';
    default:
      return '';
  }
};

const LeaveTable: React.FC<LeaveTableProps> = ({ records }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-800">Type</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-800">From</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-800">To</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-800">Days</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-800">Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="px-4 py-2 text-sm text-gray-800">{r.type}</td>
              <td className="px-4 py-2 text-sm text-gray-800">{r.from}</td>
              <td className="px-4 py-2 text-sm text-gray-800">{r.to}</td>
              <td className="px-4 py-2 text-sm text-gray-800">{r.days}</td>
              <td className="px-4 py-2 text-sm">
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${statusColor(r.status)}`}>{r.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LeaveTable;
