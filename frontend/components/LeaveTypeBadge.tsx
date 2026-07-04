import React from 'react';

const typeColors: Record<string, string> = {
  'Annual Leave': 'bg-blue-100 text-blue-700 border-blue-200',
  'Casual Leave': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Medical Leave': 'bg-rose-100 text-rose-700 border-rose-200',
  'Short Leave': 'bg-purple-100 text-purple-700 border-purple-200',
  'Lieu Leave': 'bg-amber-100 text-amber-700 border-amber-200',
  'No Pay Leave': 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function LeaveTypeBadge({ name }: { name: string }) {
  const colorClass = typeColors[name] || 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
      {name}
    </span>
  );
}
