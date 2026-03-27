"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";

const MONTH = "February 2026";
const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Feb 2026: starts Sunday (0), 28 days
const START_DAY = 0;
const TOTAL_DAYS = 28;
const TODAY = 5;    // Feb 5 highlighted in solid orange

// Holidays — light orange background with tooltip
const HOLIDAYS: Record<number, string> = {
  9: "Poya day",
  10: "Staff Wellbeing Day",
  15: "Company Holiday",
};

function buildCalendar(): (number | null)[] {
  const cells: (number | null)[] = [];
  for (let i = 0; i < START_DAY; i++) cells.push(null);
  for (let d = 1; d <= TOTAL_DAYS; d++) cells.push(d);
  return cells;
}

export default function CalendarWidget() {
  const [hoveredHoliday, setHoveredHoliday] = useState<number | null>(null);
  const cells = buildCalendar();

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm h-full w-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-base font-semibold text-gray-800">{MONTH}</h3>
        <CalendarDays size={16} className="text-gray-400" />
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-0.5 flex-1">
        {cells.map((day, i) => {
          const isToday = day === TODAY;
          const isHoliday = day !== null && HOLIDAYS[day] !== undefined;

          return (
            <div key={i} className="relative flex items-center justify-center">
              <div
                onMouseEnter={() => isHoliday && day !== null ? setHoveredHoliday(day) : undefined}
                onMouseLeave={() => setHoveredHoliday(null)}
                className={`
                  w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium transition-colors
                  ${isToday ? "bg-[#F2924E] text-white" : ""}
                  ${isHoliday && !isToday ? "bg-orange-100 text-orange-700 cursor-default" : ""}
                  ${!isToday && !isHoliday && day ? "text-gray-700 hover:bg-gray-50 cursor-default" : ""}
                `}
              >
                {day ?? ""}
              </div>

              {/* Holiday tooltip */}
              {isHoliday && hoveredHoliday === day && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 pointer-events-none">
                  <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                    {HOLIDAYS[day!]}
                  </div>
                  <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
