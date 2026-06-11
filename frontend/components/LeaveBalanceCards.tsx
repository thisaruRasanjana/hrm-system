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
            className="bg-[#FFF3E6] border border-[#F5C28B] rounded-xl p-5"
          >
            <p className="text-sm text-gray-600 mb-1">
              {type} Leaves
            </p>
            <h2 className="text-2xl font-bold text-gray-800">
              {amount} days
            </h2>
          </div>
        ))}
    </div>
  );
}