"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight, Play, StopCircle, Clock, Pause, RotateCcw,
  CheckCircle2, AlertCircle, CalendarDays, ChevronLeft,
  ChevronDown, Settings,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { useDialog } from "@/context/dialog-context";
import { TIME_TRACKING_EDIT_OVERTIME_THRESHOLD } from "@/lib/permissions";

// ── Types ────────────────────────────────────────────────────────────────────────
interface CheckPair {
  id: number;
  check_in: string;
  check_out: string | null;
  seconds: number | null;
}

interface DayEntry {
  date: string;
  total_hours: number | null;
  overtime: number | null;
  status: string;
  pairs: CheckPair[];
}

interface WeeklyStats {
  week_start: string;
  week_end: string;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  overtime_threshold: number;
  entries: DayEntry[];
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

function fmtPairDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "In progress...";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// ── Page ─────────────────────────────────────────────────────────────────────────
export default function TimeTrackingPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const { showAlert } = useDialog();

  // Timer state (3-state: not clocked in / working / paused)
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [accumulatedSecs, setAccumulatedSecs] = useState(0);
  const [clockInTime, setClockInTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  // Stats state
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // Expandable day rows
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Overtime threshold editor
  const [showThresholdEditor, setShowThresholdEditor] = useState(false);
  const [thresholdValue, setThresholdValue] = useState("");
  const [thresholdSaving, setThresholdSaving] = useState(false);

  const canEditThreshold = hasPermission(TIME_TRACKING_EDIT_OVERTIME_THRESHOLD);

  // ── Tick from accumulated + live delta ────────────────────────────────────────
  const startTick = useCallback((clockIn: Date, accumulated: number) => {
    if (tickRef.current) clearInterval(tickRef.current);
    const update = () => {
      const liveDelta = Math.floor((Date.now() - clockIn.getTime()) / 1000);
      setElapsed(accumulated + liveDelta);
    };
    update();
    tickRef.current = setInterval(update, 1000);
  }, []);

  const stopTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  // ── Init: fetch current session from DB ──────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const res = await apiFetch("/time-tracking/current");
        if (res.ok) {
          const data = await res.json();
          if (data.active) {
            const accumulated = data.elapsed_seconds || 0;
            setAccumulatedSecs(accumulated);

            if (data.paused) {
              setIsRunning(true);
              setIsPaused(true);
              setElapsed(accumulated);
            } else if (data.clock_in) {
              const dateStr = data.clock_in;
              const clockIn = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
              setClockInTime(clockIn);
              setIsRunning(true);
              setIsPaused(false);
              startTick(clockIn, accumulated);
            }
          } else if (data.completed) {
            setIsCompleted(true);
          }
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    init();
    return () => stopTick();
  }, [startTick, stopTick]);

  // ── Fetch weekly stats ───────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await apiFetch(`/time-tracking/weekly-stats?week=${weekOffset}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setThresholdValue(String(data.overtime_threshold ?? 8));
      }
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
        setAccumulatedSecs(0);
        setIsRunning(true);
        setIsPaused(false);
        startTick(clockIn, 0);
        fetchStats();
      } else {
        const err = await res.json();
        await showAlert(err.detail || "Failed to start session", { title: "Couldn't start session" });
      }
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  // ── Pause ────────────────────────────────────────────────────────────────────
  const handlePause = async () => {
    if (busy || !isRunning || isPaused) return;
    setBusy(true);
    try {
      const res = await apiFetch("/time-tracking/pause", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        stopTick();
        const accumulated = data.elapsed_seconds || 0;
        setAccumulatedSecs(accumulated);
        setElapsed(accumulated);
        setClockInTime(null);
        setIsPaused(true);
        fetchStats();
      } else {
        const err = await res.json();
        await showAlert(err.detail || "Failed to pause", { title: "Couldn't pause session" });
      }
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  // ── Resume ───────────────────────────────────────────────────────────────────
  const handleResume = async () => {
    if (busy || !isRunning || !isPaused) return;
    setBusy(true);
    try {
      const res = await apiFetch("/time-tracking/resume", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const dateStr = data.clock_in;
        const clockIn = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
        const accumulated = data.elapsed_seconds || 0;
        setClockInTime(clockIn);
        setAccumulatedSecs(accumulated);
        setIsPaused(false);
        startTick(clockIn, accumulated);
        fetchStats();
      } else {
        const err = await res.json();
        await showAlert(err.detail || "Failed to resume", { title: "Couldn't resume session" });
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
        stopTick();
        setIsRunning(false);
        setIsPaused(false);
        setElapsed(0);
        setAccumulatedSecs(0);
        setClockInTime(null);
        setIsCompleted(true);
        fetchStats();
      } else {
        const err = await res.json();
        await showAlert(err.detail || "Failed to end session", { title: "Couldn't end session" });
      }
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  // ── Overtime threshold save ──────────────────────────────────────────────────
  const handleSaveThreshold = async () => {
    const val = parseFloat(thresholdValue);
    if (isNaN(val) || val <= 0 || val > 24) {
      await showAlert("Please enter a valid number between 0 and 24.", {
        title: "Invalid threshold",
        tone: "warning",
      });
      return;
    }
    setThresholdSaving(true);
    try {
      const res = await apiFetch("/time-tracking/overtime-threshold", {
        method: "PUT",
        body: JSON.stringify({ threshold_hours: val }),
      });
      if (res.ok) {
        setShowThresholdEditor(false);
        fetchStats();
      } else {
        const err = await res.json();
        await showAlert(err.detail || "Failed to save threshold", { title: "Couldn't save threshold" });
      }
    } catch (e) { console.error(e); }
    finally { setThresholdSaving(false); }
  };

  // ── Toggle day expansion ─────────────────────────────────────────────────────
  const toggleDay = (date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const clockInDisplay = clockInTime
    ? clockInTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  const entries = stats?.entries ?? [];

  // Banner colors based on state
  const bannerBg = isCompleted ? "bg-gray-500" : isPaused ? "bg-amber-500" : "bg-[#F2924E]";
  const bannerIcon = isCompleted ? <CheckCircle2 size={48} className="text-white opacity-90" /> : isPaused ? <Pause size={48} className="text-amber-100 opacity-90" /> : <Play size={48} className="text-white opacity-90" />;
  const bannerTitle = isCompleted ? "Day Ended" : isPaused ? "Work Paused" : isRunning ? "Currently Clocked In" : "Ready to Start?";
  const bannerSub = isCompleted
    ? "Your work day has been completed."
    : isPaused
      ? "Take your time. Click resume when you're back."
      : isRunning
        ? `You started working at ${clockInDisplay}`
        : "Start your timer when you're ready to begin.";

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

      {/* Current Status Banner — 3-state */}
      <div className={`${bannerBg} rounded-2xl px-8 py-6 flex items-center justify-between transition-colors`}>
        <div>
          <p className="text-white/80 text-sm font-medium mb-1">
            {bannerTitle}
          </p>
          {loading ? (
            <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mt-2" />
          ) : (
            <>
              <h2 className="text-5xl font-bold text-white tracking-tight font-mono">
                {fmtElapsed(elapsed)}
              </h2>
              <p className="text-white/70 text-sm mt-2">
                {bannerSub}
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isCompleted ? (
            <button
              disabled
              className="bg-white/50 text-white transition px-6 py-3 rounded-xl flex items-center gap-2 font-semibold text-sm shadow cursor-not-allowed border border-white/20"
            >
              <CheckCircle2 size={16} /> Day Ended
            </button>
          ) : !isRunning ? (
            /* NOT CLOCKED IN → Start */
            <button
              onClick={handleStart}
              disabled={busy || loading}
              className="bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50 transition px-6 py-3 rounded-xl flex items-center gap-2 font-semibold text-sm shadow"
            >
              <Play size={16} className="text-[#F2924E]" fill="#F2924E" /> Start Work
            </button>
          ) : isPaused ? (
            /* PAUSED → Resume + End */
            <>
              <button
                onClick={handleResume}
                disabled={busy || loading}
                className="bg-white text-green-700 hover:bg-green-50 disabled:opacity-50 transition px-5 py-3 rounded-xl flex items-center gap-2 font-semibold text-sm shadow"
              >
                <RotateCcw size={16} className="text-green-600" /> Resume Work
              </button>
              <button
                onClick={handleEnd}
                disabled={busy || loading}
                className="bg-white/20 hover:bg-white/30 text-white disabled:opacity-50 transition px-5 py-3 rounded-xl flex items-center gap-2 font-semibold text-sm border border-white/30"
              >
                <StopCircle size={16} /> End Work
              </button>
            </>
          ) : (
            /* WORKING → Pause + End */
            <>
              <button
                onClick={handlePause}
                disabled={busy || loading}
                className="bg-white text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition px-5 py-3 rounded-xl flex items-center gap-2 font-semibold text-sm shadow"
              >
                <Pause size={16} className="text-amber-600" /> Pause Work
              </button>
              <button
                onClick={handleEnd}
                disabled={busy || loading}
                className="bg-white/20 hover:bg-white/30 text-white disabled:opacity-50 transition px-5 py-3 rounded-xl flex items-center gap-2 font-semibold text-sm border border-white/30"
              >
                <StopCircle size={16} /> End Work
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats row */}
      {statsLoading ? (
        <div className="grid grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
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
              sub: `Beyond ${stats?.overtime_threshold ?? 8}h/day`,
              Icon: AlertCircle,
              iconColor: "text-orange-500",
              bg: "bg-orange-50",
              hasGear: true,
            },
          ].map(({ label, value, sub, Icon, iconColor, bg, hasGear }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-2xl p-5 relative">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon size={16} className={iconColor} />
                </div>
                <span className="text-sm text-gray-500">{label}</span>
                {/* Gear icon for overtime threshold (permission-gated) */}
                {hasGear && canEditThreshold && (
                  <button
                    onClick={() => setShowThresholdEditor(!showThresholdEditor)}
                    className="ml-auto p-1 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-600"
                    title="Edit overtime threshold"
                  >
                    <Settings size={14} />
                  </button>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-1">{sub}</p>

              {/* Threshold editor dropdown */}
              {hasGear && showThresholdEditor && canEditThreshold && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-lg p-4 z-20">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Daily Overtime Threshold
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      value={thresholdValue}
                      onChange={(e) => setThresholdValue(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2924E]/40 focus:border-[#F2924E]"
                      placeholder="Hours"
                    />
                    <button
                      onClick={handleSaveThreshold}
                      disabled={thresholdSaving}
                      className="bg-[#F2924E] hover:bg-[#e07d3a] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition"
                    >
                      {thresholdSaving ? "..." : "Save"}
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-600 mt-2 flex items-center gap-1">
                    <AlertCircle size={11} />
                    Changes only affect today and future records
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Time Entries Table — Day-grouped with expandable pairs */}
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
                {["", "DATE", "TOTAL HOURS", "OVERTIME", "STATUS", "SESSIONS"].map((h) => (
                  <th key={h} className="text-left text-xs text-gray-400 font-medium px-6 py-3 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((day) => {
                const isExpanded = expandedDays.has(day.date);
                const pairCount = day.pairs?.length ?? 0;

                return (
                  <React.Fragment key={day.date}>
                    {/* Day summary row */}
                    <tr
                      className="border-t border-gray-100 hover:bg-gray-50 transition cursor-pointer"
                      onClick={() => pairCount > 0 && toggleDay(day.date)}
                    >
                      {/* Expand chevron */}
                      <td className="pl-4 pr-0 py-4 w-8">
                        {pairCount > 0 && (
                          <ChevronDown
                            size={16}
                            className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-700 font-medium">{fmtDate(day.date)}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {fmtDecimalHours(day.total_hours)}
                      </td>
                      <td className="px-6 py-4">
                        {day.overtime != null && day.overtime > 0 ? (
                          <span className="text-orange-500 font-medium">
                            +{fmtDecimalHours(day.overtime)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {day.status === "active" ? (
                          <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            In Progress
                          </span>
                        ) : day.status === "paused" ? (
                          <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1 w-fit">
                            <Pause size={10} />
                            Paused
                          </span>
                        ) : (
                          <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-3 py-1 rounded-full">
                            Completed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {pairCount} {pairCount === 1 ? "session" : "sessions"}
                      </td>
                    </tr>

                    {/* Expanded pairs */}
                    {isExpanded && day.pairs && day.pairs.map((pair) => (
                      <tr key={pair.id} className="bg-gray-50/70 border-t border-gray-100/60">
                        <td className="pl-4 pr-0 py-3 w-8">
                          <div className="w-3 h-3 rounded-full border-2 border-[#F2924E]/40 ml-0.5" />
                        </td>
                        <td className="px-6 py-3 text-gray-500 text-xs" colSpan={1}>
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-400 uppercase font-semibold w-6">In</span>
                              <span className="text-gray-700 font-medium">{fmtTime(pair.check_in)}</span>
                            </span>
                            <span className="text-gray-300">→</span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-400 uppercase font-semibold w-7">Out</span>
                              <span className="text-gray-700 font-medium">{fmtTime(pair.check_out)}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-gray-500 text-xs" colSpan={1}>
                          {fmtPairDuration(pair.seconds)}
                        </td>
                        <td colSpan={3}></td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}