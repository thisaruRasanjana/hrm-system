'use client';

/**
 * LeaveBalanceCards.tsx
 * ---------------------
 * Renders one card per leave type showing remaining days, used days,
 * a progress bar, and percentage labels.
 *
 * LEAVE_TOTALS below must match the LEAVE_ENTITLEMENTS dict in
 * backend/app/core/config.py. If entitlements change, update both.
 */


interface Props {
  balances: Record<string, number>;
}

// SVG icons — clean, professional, no emojis
const LeaveIcons: Record<string, React.ReactNode> = {
  'Annual Leave': (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  ),
  'Medical Leave': (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  'Casual Leave': (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
};

const DefaultIcon = (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

/**
 * Annual allocations per leave type (days / year).
 * Keep in sync with backend app/core/config.py → LEAVE_ENTITLEMENTS.
 */
const LEAVE_TOTALS: Record<string, number> = {
  'Annual Leave':  15,
  'Medical Leave': 15,
  'Casual Leave':  10,
};

const LEAVE_CONFIG: Record<string, {
  accent:    string;
  accentBg:  string;
  bg:        string;
  border:    string;
  bar:       string;
  pill:      string;
  pillText:  string;
}> = {
  'Annual Leave': {
    accent:   'text-orange-500',
    accentBg: 'bg-orange-100',
    bg:       'bg-orange-50',
    border:   'border-orange-200',
    bar:      'bg-orange-400',
    pill:     'bg-orange-100',
    pillText: 'text-orange-700',
  },
  'Medical Leave': {
    accent:   'text-blue-500',
    accentBg: 'bg-blue-100',
    bg:       'bg-blue-50',
    border:   'border-blue-200',
    bar:      'bg-blue-400',
    pill:     'bg-blue-100',
    pillText: 'text-blue-700',
  },
  'Casual Leave': {
    accent:   'text-green-500',
    accentBg: 'bg-green-100',
    bg:       'bg-green-50',
    border:   'border-green-200',
    bar:      'bg-green-400',
    pill:     'bg-green-100',
    pillText: 'text-green-700',
  },
};

const DEFAULT_CONFIG = {
  accent:   'text-gray-500',
  accentBg: 'bg-gray-100',
  bg:       'bg-gray-50',
  border:   'border-gray-200',
  bar:      'bg-gray-400',
  pill:     'bg-gray-100',
  pillText: 'text-gray-700',
};

/** Grid of leave balance cards — one card per leave type returned by the API. */
export default function LeaveBalanceCards({ balances }: Props) {
  // Filter out any unexpected leave types (e.g. sick, short-term) the backend
  // might return that have no matching frontend config.
  const entries = Object.entries(balances).filter(([type]) => {
    const t = type.toLowerCase();
    return t !== 'sick' && !t.includes('short');
  });

  return (
    <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-3">
      {entries.map(([type, remaining]) => {
        const cfg       = LEAVE_CONFIG[type] ?? DEFAULT_CONFIG;
        // Resolve total from the centralised LEAVE_TOTALS map.
        const total     = LEAVE_TOTALS[type] ?? 15;
        const used      = Math.max(0, total - remaining);
        const usedPct   = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
        const remainPct = 100 - usedPct;
        const icon      = LeaveIcons[type] ?? DefaultIcon;

        return (
          <div
            key={type}
            className={`rounded-xl border ${cfg.border} ${cfg.bg} px-4 py-3 shadow-sm transition-shadow hover:shadow-md`}
          >
            {/* Header: icon + allocation pill */}
            <div className="flex items-center justify-between mb-2">
              <div className={`flex items-center justify-center h-7 w-7 rounded-lg ${cfg.accentBg} ${cfg.accent}`}>
                {icon}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.pill} ${cfg.pillText}`}>
                {total} days / yr
              </span>
            </div>

            {/* Leave type name */}
            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${cfg.accent}`}>
              {type}
            </p>

            {/* Big remaining number */}
            <div className="flex items-baseline gap-1 mb-0.5">
              <span className="text-2xl font-bold text-gray-900">{remaining}</span>
              <span className="text-xs text-gray-500">days left</span>
            </div>

            {/* Used info */}
            <p className="text-[10px] text-gray-400 mb-2">
              {used} used &middot; {total} allocated
            </p>

            {/* Progress bar */}
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/80">
              <div
                className={`h-1 rounded-full ${cfg.bar} transition-all duration-500`}
                style={{ width: `${usedPct}%` }}
              />
            </div>

            {/* Labels under bar */}
            <div className="mt-1 flex justify-between text-[10px] text-gray-400">
              <span>{usedPct}% used</span>
              <span>{remainPct}% remaining</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}