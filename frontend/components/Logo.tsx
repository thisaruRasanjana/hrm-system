import React from 'react';

interface LogoProps {
  withText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ withText = true }) => {
  return (
    <div className="flex items-center space-x-3">
      <div className="w-10 h-10 rounded-lg bg-orange-400 flex items-center justify-center flex-shrink-0">
        <svg viewBox="0 0 48 48" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <rect width="48" height="48" rx="8" fill="#fb923c" />
          <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" fontWeight={800} fontSize={16} fill="#fff">HR</text>
        </svg>
      </div>
      {withText && (
        <div className="leading-tight">
          <div className="text-lg font-semibold text-gray-900">HRMS</div>
          <div className="text-xs text-gray-500">Management System</div>
        </div>
      )}
    </div>
  );
};

export default Logo;
