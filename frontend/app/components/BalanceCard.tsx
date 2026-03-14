import React from 'react';

interface BalanceCardProps {
  type: string;
  remaining: number;
  total: number;
  colorClass?: string; // tailwind background color
}

const BalanceCard: React.FC<BalanceCardProps> = ({ type, remaining, total, colorClass = 'bg-[#FFF3E6] border-[#F5C28B]' }) => {
  return (
    <div className={`rounded-xl p-5 shadow-sm border ${colorClass} flex flex-col`}>      
      <span className="text-sm text-gray-600 mb-1">{type}</span>
      <span className="text-2xl font-bold text-gray-800">
        {remaining} / {total}
      </span>
    </div>
  );
};

export default BalanceCard;
