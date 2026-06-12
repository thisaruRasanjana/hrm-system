import React from 'react';

interface Props {
  balances: Record<string, number>;
}

export default function LeaveBalanceCards({ balances }: Props) {
  return (
    <div className="grid grid-cols-2 gap-6 mb-6">
      {Object.entries(balances)
        // don't display sick leave on this page
        .filter(([type]) => type.toLowerCase() !== 'sick')
        .map(([type, amount]) => (
          <div
            key={type}
            className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5"
          >
            <p className="text-sm text-gray-500 mb-1">
              {type} Leaves
            </p>
            <h2 className="text-2xl font-bold text-[#F2924E]">
              {amount} <span className="text-base font-medium text-gray-500">days left</span>
            </h2>
          </div>
        ))}
    </div>
  );
}