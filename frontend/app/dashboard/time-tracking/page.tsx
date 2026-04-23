"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight, Play, StopCircle, Clock,
  CheckCircle2, AlertCircle, CalendarDays, ChevronLeft
} from "lucide-react";
import { apiFetch } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────────
interface TimeEntry {
  id: number;
  clock_in: string;
  clock_out: string | null;
  total_hours: number | null;
  overtime: number | null;
  status: string;
  work_date: string | null;
}

interface WeeklyStats {
  week_start: string;
  week_end: string;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  avg_clock_in: string | null;
  entries: TimeEntry[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────────
function fmtElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtDecimalHours(h: number | null): string {
  if (h === null || h === undefined) return "—";
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + (iso.endsWith("Z") ? "" : "Z"))
    .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  return new Date(isoDate + "T00:00:00")
    .toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function fmtWeekRange(start: string, end: string) {
  const s = new Date(start + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" });
  const e = new Date(end   + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  return `${s} – ${e}`;
}

// ── Page ─────────────────────────────────────────────────────────────────────────
export default function TimeTrackingPage() {
  const router = useRouter();

  // Timer state
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  // Stats state
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Tick from DB clock_in ────────────────────────────────────────────────────
  const startTick = useCallback((clockIn: Date) => {
    if (tickRef.current) clearInterval(tickRef.current);
    const update = () =>
      setElapsed(Math.floor((Date.now() - clockIn.getTime()) / 1000));
    update();
    tickRef.current = setInterval(update, 1000);
  }, []);

  // ── Init: fetch current session from DB ──────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const res = await apiFetch("/time-tracking/current");
        if (res.ok) {
          const data = await res.json();
          if (data.active && data.clock_in) {
            const dateStr = data.clock_in;
            const clockIn = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
            setClockInTime(clockIn);
            setIsRunning(true);
            startTick(clockIn);
          }
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    init();
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [startTick]);

  // ── Fetch weekly stats ───────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await apiFetch(`/time-tracking/weekly-stats?week=${weekOffset}`);
      if (res.ok) setStats(await res.json());
    } catch (e) { console.error(e); }
    finally { setStatsLoading(false); }
  }, [weekOffset]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Clock In ─────────────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (busy || isRunning) return;
    setBusy(true);
    try {
      const res = await apiFetch("/time-tracking/start", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const dateStr = data.clock_in;
        const clockIn = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
        setClockInTime(clockIn);
        setIsRunning(true);
        startTick(clockIn);
        fetchStats();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to start session");
      }
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  // ── Clock Out ────────────────────────────────────────────────────────────────
  const handleEnd = async () => {
    if (busy || !isRunning) return;
    setBusy(true);
    try {
      const res = await apiFetch("/time-tracking/end", { method: "POST" });
      if (res.ok) {
        if (tickRef.current) clearInterval(tickRef.current);
        setIsRunning(false);
        setElapsed(0);
        setClockInTime(null);
        fetchStats();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to end session");
      }
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  const clockInDisplay = clockInTime
    ? clockInTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  const entries = stats?.entries ?? [];

  return (
    <div className="flex flex-col gap-6">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <button onClick={() => router.push("/dashboard")} className="hover:text-[#F2924E] transition">
          Dashboard
        </button>
        <ChevronRight size={14} />
        <span className="text-gray-800 font-medium">Time Tracking</span>
      </nav>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Time Tracking</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track your work hours, view clock-in/out history, and manage overtime
        </p>
      </div>

      {/* Current Status Banner */}
      <div className="bg-[#F2924E] rounded-2xl px-8 py-6 flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium mb-1">
            {isRunning ? "Currently Working" : "Ready to Start"}
          </p>
          {loading ? (
            <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mt-2" />
          ) : (
            <>
              <h2 className="text-5xl font-bold text-white tracking-tight font-mono">
                {fmtElapsed(elapsed)}
              </h2>
              <p className="text-white/70 text-sm mt-2">
                {isRunning
                  ? `Clocked in at ${clockInDisplay}`
                  : "Click 'Start Work' to begin your session"}
              </p>
            </>
          )}
        </div>

        <button
          onClick={isRunning ? handleEnd : handleStart}
          disabled={busy || loading}
          className="bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50 transition px-6 py-3 rounded-xl flex items-center gap-2 font-semibold text-sm shadow"
        >
          {isRunning ? (
            <><StopCircle size={16} className="text-orange-500" /> End Work</>
          ) : (
            <><Play size={16} className="text-[#F2924E]" fill="#F2924E" /> Start Work</>
          )}
        </button>
      </div>

      {/* Stats row */}
      {statsLoading ? (
        <div className="grid grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-5">
          {[
            {
              label: "Total Hours",
              value: fmtDecimalHours(stats?.total_hours ?? 0),
              sub: "This week",
              Icon: Clock,
              iconColor: "text-blue-500",
              bg: "bg-blue-50",
            },
            {
              label: "Regular Hours",
              value: fmtDecimalHours(stats?.regular_hours ?? 0),
              sub: "Standard time",
              Icon: CheckCircle2,
              iconColor: "text-green-500",
              bg: "bg-green-50",
            },
            {
              label: "Overtime",
              value: fmtDecimalHours(stats?.overtime_hours ?? 0),
              sub: "Extra hours",
              Icon: AlertCircle,
              iconColor: "text-orange-500",
              bg: "bg-orange-50",
            },
            {
              label: "Avg Check-In",
              value: stats?.avg_clock_in ?? "—",
              sub: "This week",
              Icon: CalendarDays,
              iconColor: "text-purple-500",
              bg: "bg-purple-50",
            },
          ].map(({ label, value, sub, Icon, iconColor, bg }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon size={16} className={iconColor} />
                </div>
                <span className="text-sm text-gray-500">{label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-1">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Time Entries Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">

        {/* Table header with week navigation */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-800">Time Entries</h3>
            {stats && (
              <p className="text-xs text-gray-400 mt-0.5">{fmtWeekRange(stats.week_start, stats.week_end)}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
            >
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition disabled:opacity-40"
            >
              This Week
            </button>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              disabled={weekOffset >= 0}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition disabled:opacity-40"
            >
              <ChevronRight size={16} className="text-gray-600" />
            </button>
          </div>
        </div>

        {statsLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading entries...</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <Clock size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No entries this week</p>
            <p className="text-gray-400 text-sm mt-1">Click &quot;Start Work&quot; to begin tracking</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["DATE", "CHECK IN", "CHECK OUT", "TOTAL HOURS", "OVERTIME", "STATUS"].map((h) => (
                  <th key={h} className="text-left text-xs text-gray-400 font-medium px-6 py-3 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-6 py-4 text-gray-700">{fmtDate(row.work_date)}</td>
                  <td className="px-6 py-4 text-gray-600">{fmtTime(row.clock_in)}</td>
                  <td className="px-6 py-4 text-gray-600">{fmtTime(row.clock_out)}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {fmtDecimalHours(row.total_hours)}
                  </td>
                  <td className="px-6 py-4">
                    {row.overtime != null && row.overtime > 0 ? (
                      <span className="text-orange-500 font-medium">
                        +{fmtDecimalHours(row.overtime)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {row.status === "active" ? (
                      <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1 w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Active
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-3 py-1 rounded-full">
                        Completed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}