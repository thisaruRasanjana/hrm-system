"use client";

import { BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ATTENDANCE_VIEW_OTHERS } from "@/lib/permissions";

interface Props { permissions: string[] }

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function AttendanceWidget({ permissions }: Props) {
  const router = useRouter();
  
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayHours, setDayHours] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Date range label
  const [dateRangeLabel, setDateRangeLabel] = useState("");

  const canViewOthers = permissions.includes(ATTENDANCE_VIEW_OTHERS);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/time-tracking/weekly-stats?week=${weekOffset}`);
        if (!res.ok) return;
        const stats = await res.json();

        // Build Mon-Sun buckets from day-level entries
        const buckets = [0, 0, 0, 0, 0, 0, 0];
        (stats.entries ?? []).forEach((entry: any) => {
          if (!entry.date || entry.total_hours == null) return;
          const day = new Date(entry.date + "T00:00:00").getDay();
          const idx = day === 0 ? 6 : day - 1;
          buckets[idx] += Number(entry.total_hours);
        });

        setDayHours(buckets);
        setTotalHours(parseFloat(buckets.reduce((a, b) => a + b, 0).toFixed(1)));
        
        // Format date range
        if (stats.week_start && stats.week_end) {
          const start = new Date(stats.week_start + "T00:00:00");
          const end = new Date(stats.week_end + "T00:00:00");
          
          const formatOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
          const startStr = start.toLocaleDateString("en-US", formatOpts);
          
          const endFormatOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
          const endStr = end.toLocaleDateString("en-US", endFormatOpts);
          
          setDateRangeLabel(`${startStr} – ${endStr}`);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [weekOffset]);

  const maxH = Math.max(...dayHours, 1);
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;

  const handlePrevWeek = () => setWeekOffset(prev => prev - 1);
  const handleNextWeek = () => setWeekOffset(prev => prev + 1);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm h-full w-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-base font-semibold text-gray-800">Attendance</h3>
        <div className="flex items-center gap-2">
          <button onClick={handlePrevWeek} className="text-gray-400 hover:text-gray-700 transition p-1">
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-medium text-gray-500 w-32 text-center whitespace-nowrap">
            {dateRangeLabel || "—"}
          </span>
          <button onClick={handleNextWeek} className="text-gray-400 hover:text-gray-700 transition p-1" disabled={weekOffset === 0}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Total */}
      <div className="text-3xl font-bold text-gray-900 mt-1">
        {loading ? "—" : `${totalHours}h`}
      </div>
      <p className="text-xs text-gray-400 mb-4">total this week</p>

      {/* Bar chart */}
      <div className="flex-1 flex flex-col justify-end">
        <div className="flex items-end gap-1.5 h-24">
          {dayHours.map((h, i) => {
            const isToday = i === todayIdx && weekOffset === 0;
            return (
              <div
                key={i}
                title={`${DAYS[i]}: ${h.toFixed(1)}h`}
                className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
              >
                <div
                  className={`w-full rounded-t-lg relative group cursor-default transition-all
                    ${isToday ? "bg-[#F2924E]" : "bg-orange-200 hover:bg-orange-300"}`}
                  style={{ height: loading ? "4px" : `${Math.max((h / maxH) * 100, h > 0 ? 8 : 0)}%`, minHeight: "4px" }}
                >
                  {h > 0 && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-[10px] font-medium py-0.5 px-1.5 rounded z-10 whitespace-nowrap shadow">
                      {h.toFixed(1)}h
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* Day labels */}
        <div className="flex gap-1.5 mt-1.5">
          {DAYS.map((d, i) => (
            <div key={i} className={`flex-1 text-[10px] text-center font-medium ${i === todayIdx && weekOffset === 0 ? "text-[#F2924E]" : "text-gray-400"}`}>
              {d}
            </div>
          ))}
        </div>
      </div>
 
      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-gray-100 flex justify-end">
        {canViewOthers && (
          <button 
            onClick={() => router.push("/dashboard/attendance")}
            className="text-[#f2924e] text-[10px] font-bold uppercase tracking-wider hover:underline"
          >
            View Others&apos; Attendance
          </button>
        )}
      </div>
    </div>
  );
}
