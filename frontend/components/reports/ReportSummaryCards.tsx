import React from "react";

export type SummaryCard = {
  label: string;
  value: number;
  sublabel?: string;
  color: {
    bg: string;
    border: string;
    value: string;
    bar: string;
    pill: string;
    pillText: string;
  };
};

// Professional SVG icons per card index (Approved, Pending, Rejected)
const CARD_ICONS = [
  // Approved — check circle
  <svg key="approved" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>,
  // Pending — clock
  <svg key="pending" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>,
  // Rejected — x circle
  <svg key="rejected" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>,
];

// Icon background colours: Approved=green, Pending=yellow, Rejected=red
const ICON_BG = ["bg-green-100 text-green-500", "bg-yellow-100 text-yellow-600", "bg-red-100 text-red-500"];

interface Props {
  cards: SummaryCard[];
  total?: number;
}

export default function ReportSummaryCards({ cards, total }: Props) {
  const max = total ?? Math.max(...cards.map((c) => c.value), 1);

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card, idx) => {
        const pct = max > 0 ? Math.round((card.value / max) * 100) : 0;

        return (
          <div
            key={card.label}
            className={`rounded-xl border ${card.color.border} ${card.color.bg} px-4 py-3 shadow-sm transition-shadow hover:shadow-md`}
          >
            {/* Top row: icon box + percentage pill */}
            <div className="flex items-start justify-between mb-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${ICON_BG[idx] ?? "bg-gray-100 text-gray-500"}`}>
                {CARD_ICONS[idx]}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${card.color.pill} ${card.color.pillText}`}>
                {pct}%
              </span>
            </div>

            {/* Big value */}
            <p className={`text-2xl font-bold ${card.color.value}`}>{card.value}</p>

            {/* Label */}
            <p className="mt-0.5 text-sm font-medium text-gray-700">{card.label}</p>

            {/* Sub-label */}
            {card.sublabel && (
              <p className="mt-0.5 text-[10px] text-gray-400">{card.sublabel}</p>
            )}

            {/* Progress bar */}
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/60">
              <div
                className={`h-1 rounded-full transition-all duration-500 ${card.color.bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}