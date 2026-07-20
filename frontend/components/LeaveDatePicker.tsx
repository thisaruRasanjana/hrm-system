"use client";

import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Holiday {
  id: number;
  name: string;
  date: string;
}

interface DateSelection {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  halfDay: boolean;
}

interface Props {
  onChange: (selection: DateSelection) => void;
  value: DateSelection;
  holidays?: Holiday[];
}

const DAYS_OF_WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function toYMD(date: Date): string {
  // Use local date parts (not UTC) so the calendar reflects the user's timezone.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseYMD(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplay(start: string, end: string, halfDay: boolean, holidays: Holiday[]): string {
  if (!start) return "";
  const s = parseYMD(start);
  const fmt = (d: Date) =>
    `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  const holidaySet = new Set(holidays.map(h => h.date));

  if (halfDay || start === end) {
    const dayOfWeek = s.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidaySet.has(start);
    const dayCount = (isWeekend || isHoliday) ? 0 : (halfDay ? 0.5 : 1);
    return `${fmt(s)} (${dayCount} day${dayCount !== 1 ? "s" : ""})`;
  }

  const e = parseYMD(end);
  let workingDays = 0;
  let current = new Date(s);
  while (current <= e) {
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    const currentStr = `${y}-${m}-${d}`;
    const isHoliday = holidaySet.has(currentStr);

    if (!isWeekend && !isHoliday) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  return `${fmt(s)} → ${fmt(e)} (${workingDays} days)`;
}

export default function LeaveDatePicker({ onChange, value, holidays: initialHolidays }: Props) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selecting, setSelecting] = useState<"start" | "end">("start");
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays || []);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const today = toYMD(new Date());

  // Sync prop changes
  useEffect(() => {
    if (initialHolidays) {
      setHolidays(initialHolidays);
    }
  }, [initialHolidays]);

  // Fetch holidays on mount if not provided as prop
  useEffect(() => {
    if (initialHolidays) return;
    const fetchHolidays = async () => {
      try {
        const res = await apiFetch("/holidays");
        if (res.ok) {
          const data = await res.json();
          setHolidays(data);
        }
      } catch (err) {
        console.error("Failed to load holidays:", err);
      }
    };
    fetchHolidays();
  }, [initialHolidays]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Build grid for current month view
  const firstDay = new Date(viewYear, viewMonth, 1);
  // Monday-based: Mon=0 … Sun=6
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const holidayMap = new Map<number, string>();
  const pad = (n: number) => String(n).padStart(2, "0");
  const prefix = `${viewYear}-${pad(viewMonth + 1)}`;
  holidays.forEach(h => {
    if (h.date.startsWith(prefix)) {
      holidayMap.set(parseInt(h.date.split("-")[2]), h.name);
    }
  });

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const handleDayClick = (day: number) => {
    const clicked = toYMD(new Date(viewYear, viewMonth, day));
    if (clicked < today) return; // past — blocked

    if (value.halfDay) {
      // Half day: always single date
      onChange({ startDate: clicked, endDate: clicked, halfDay: true });
      setOpen(false);
      return;
    }

    if (selecting === "start") {
      onChange({ startDate: clicked, endDate: clicked, halfDay: false });
      setSelecting("end");
    } else {
      if (clicked < value.startDate) {
        // Clicked before start → reset as new start
        onChange({ startDate: clicked, endDate: clicked, halfDay: false });
        setSelecting("end");
      } else {
        onChange({ startDate: value.startDate, endDate: clicked, halfDay: false });
        setSelecting("start");
        setOpen(false);
      }
    }
  };

  const handleHalfDayToggle = () => {
    const next = !value.halfDay;
    if (next && value.startDate) {
      onChange({ startDate: value.startDate, endDate: value.startDate, halfDay: true });
    } else {
      onChange({ ...value, halfDay: next });
    }
    setSelecting("start");
  };

  const getCellStyle = (day: number): string => {
    const d = toYMD(new Date(viewYear, viewMonth, day));
    const isPast = d < today;
    const isStart = d === value.startDate;
    const isEnd = d === value.endDate;
    const effectiveEnd = hoverDate && selecting === "end" ? hoverDate : value.endDate;
    const inRange =
      value.startDate &&
      effectiveEnd &&
      d > value.startDate &&
      d < effectiveEnd;

    if (isPast)
      return "text-gray-300 cursor-not-allowed";
    if (isStart || isEnd)
      return "bg-[#F2924E] text-white rounded-full font-semibold cursor-pointer";
    if (inRange)
      return "bg-orange-100 text-orange-800 rounded-full cursor-pointer";
    return "text-gray-700 hover:bg-orange-50 rounded-full cursor-pointer";
  };

  const displayText = value.startDate
    ? formatDisplay(value.startDate, value.endDate, value.halfDay, holidays)
    : "";

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Trigger */}
      <div
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between w-full border border-gray-200 shadow-sm rounded-lg px-4 py-2.5 bg-white cursor-pointer hover:border-[#F2924E] transition-colors ${open ? 'ring-2 ring-orange-50 border-[#F2924E]' : ''}`}
      >
        <span className={`text-sm ${displayText ? "text-slate-700" : "text-slate-400"}`}>
          {displayText || "Pick the date :"}
        </span>
        {/* Calendar icon */}
        <svg
          className="w-5 h-5 text-gray-400 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" />
          <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" strokeLinecap="round" />
          <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" strokeLinecap="round" />
          <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
        </svg>
      </div>

      {/* Calendar popup */}
      {open && (
        <div className="absolute z-50 top-full mt-2 left-0 bg-white rounded-xl shadow-xl border border-gray-100 w-72 p-4 select-none">

          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-bold text-sm text-gray-800">{MONTHS[viewMonth]}</p>
              <p className="font-bold text-sm text-gray-800">{viewYear}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={prevMonth}
                className="text-[#F2924E] hover:text-orange-600 p-1 rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="text-[#F2924E] hover:text-orange-600 p-1 rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />;
              
              const isHoliday = holidayMap.has(day);
              const holidayName = isHoliday ? holidayMap.get(day) : "";

              return (
                <div
                  key={i}
                  title={holidayName}
                  onClick={() => handleDayClick(day)}
                  onMouseEnter={() => {
                    const d = toYMD(new Date(viewYear, viewMonth, day));
                    if (selecting === "end") setHoverDate(d);
                  }}
                  onMouseLeave={() => setHoverDate(null)}
                  className={`relative flex items-center justify-center text-sm h-8 w-8 mx-auto transition-colors ${getCellStyle(day)}`}
                >
                  {day}
                  {isHoliday && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-orange-400" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 mt-3 pt-3">
            {/* Half Day toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Half Day</span>
              <button
                type="button"
                onClick={handleHalfDayToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                  value.halfDay ? "bg-[#F2924E]" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-300 ${
                    value.halfDay ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
