"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Clock, Play, StopCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Props { permissions: string[] }

export default function TimeTrackingWidget(_: Props) {
  const router = useRouter();

  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);           // seconds
  const [clockInTime, setClockInTime] = useState<Date | null>(null);  // UTC from DB
  const [todayHours, setTodayHours] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);             // prevent double-click
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  // ── Recalculate elapsed every second from the DB clock_in timestamp ──────────
  const startTick = useCallback((clockIn: Date) => {
    if (tickRef.current) clearInterval(tickRef.current);
    const update = () =>
      setElapsed(Math.floor((Date.now() - clockIn.getTime()) / 1000));
    update();                           // immediate update
    tickRef.current = setInterval(update, 1000);
  }, []);

  // ── On mount: call /current — the ONLY source of truth ──────────────────────
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
      } catch (e) {
        console.error("Time tracking init error:", e);
      } finally {
        setLoading(false);
      }
    };
    init();
    loadTodayHours();

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [startTick]);

  const loadTodayHours = async () => {
    try {
      const res = await apiFetch("/time-tracking/history");
      if (!res.ok) return;
      const entries = await res.json();
      const today = new Date().toISOString().slice(0, 10);
      const total = entries
        .filter((e: any) => e.work_date === today && e.total_hours != null)
        .reduce((sum: number, e: any) => sum + Number(e.total_hours), 0);
      setTodayHours(parseFloat(total.toFixed(2)));
    } catch (e) { /* silent */ }
  };

  // ── Start Work ───────────────────────────────────────────────────────────────
  const handleStart = async (ev: React.MouseEvent) => {
    ev.stopPropagation();
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
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to start");
      }
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  // ── End Work ─────────────────────────────────────────────────────────────────
  const handleEnd = async (ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (busy || !isRunning) return;
    setBusy(true);
    try {
      const res = await apiFetch("/time-tracking/end", { method: "POST" });
      if (res.ok) {
        if (tickRef.current) clearInterval(tickRef.current);
        setIsRunning(false);
        setElapsed(0);
        setClockInTime(null);
        await loadTodayHours();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to end");
      }
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  const fmt = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const clockInDisplay = clockInTime
    ? clockInTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      onClick={() => router.push("/dashboard/time-tracking")}
      className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer h-full w-full flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-semibold text-gray-800">Time Tracking</h3>
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full animate-pulse">
              Live
            </span>
          )}
          <Clock size={16} className="text-gray-400" />
        </div>
      </div>

      {/* Timer display */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {loading ? (
          <div className="w-8 h-8 border-4 border-[#F2924E] border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <h1 className={`text-5xl font-bold tracking-tight font-mono ${isRunning ? "text-[#F2924E]" : "text-gray-900"}`}>
              {fmt(elapsed)}
            </h1>
            <p className="text-gray-400 text-sm mt-2">
              {isRunning
                ? `Clocked in at ${clockInDisplay}`
                : "Not clocked in"}
            </p>

            {isRunning ? (
              <button
                onClick={handleEnd}
                disabled={busy}
                className="mt-5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-8 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium w-full justify-center transition"
              >
                <StopCircle size={14} /> End Work
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={busy}
                className="mt-5 bg-[#F2924E] hover:bg-[#e4833f] disabled:opacity-50 text-white px-8 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium w-full justify-center transition"
              >
                <Play size={14} fill="white" /> Start Work
              </button>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">
        <span>Today's total</span>
        <span className="font-semibold text-gray-800">
          {todayHours !== null ? `${todayHours.toFixed(1)}h` : "—"}
        </span>
      </div>
    </div>
  );
}
