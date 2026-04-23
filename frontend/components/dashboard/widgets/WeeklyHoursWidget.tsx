"use client";

import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Props { permissions: string[] }

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function WeeklyHoursWidget(_: Props) {
  // 7 buckets Mon–Sun
  const [dayHours, setDayHours] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // Use the new weekly-stats endpoint which returns real DB data
        const res = await apiFetch("/time-tracking/weekly-stats?week=0");
        if (!res.ok) return;
        const stats = await res.json();

        // Build Mon-Sun buckets from entries
        const buckets = [0, 0, 0, 0, 0, 0, 0];
        (stats.entries ?? []).forEach((e: any) => {
          if (e.status !== "completed" || e.total_hours == null) return;
          const day = new Date(e.clock_in + (e.clock_in.endsWith("Z") ? "" : "Z")).getDay();
          // getDay: 0=Sun,1=Mon…6=Sat → map to Mon=0…Sun=6
          const idx = day === 0 ? 6 : day - 1;
          buckets[idx] += Number(e.total_hours);
        });

        setDayHours(buckets);
        setTotalHours(parseFloat(buckets.reduce((a, b) => a + b, 0).toFixed(1)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const maxH = Math.max(...dayHours, 1);
  const today = new Date().getDay();
  // getDay: 0=Sun,1=Mon…6=Sat → Mon=0…Sun=6
  const todayIdx = today === 0 ? 6 : today - 1;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm h-full w-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-base font-semibold text-gray-800">Weekly Hours</h3>
        <BarChart3 size={16} className="text-gray-400" />
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
            const isToday = i === todayIdx;
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
            <div key={i} className={`flex-1 text-[10px] text-center font-medium ${i === todayIdx ? "text-[#F2924E]" : "text-gray-400"}`}>
              {d}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
