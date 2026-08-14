"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Clock, Play, StopCircle, Pause, RotateCcw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useDialog } from "@/context/dialog-context";

interface Props { permissions: string[] }

export default function TimeTrackingWidget(_: Props) {
  const router = useRouter();
  const { showAlert } = useDialog();

  // State machine: NOT_CLOCKED_IN | WORKING | PAUSED
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);           // total display seconds
  const [accumulatedSecs, setAccumulatedSecs] = useState(0); // from completed pairs
  const [clockInTime, setClockInTime] = useState<Date | null>(null);  // current open pair's check-in
  const [todayHours, setTodayHours] = useState<number | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  // ── Tick: accumulated + live delta from current open pair ───────────────────
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

  // ── On mount: call /current — the ONLY source of truth ──────────────────────
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
              // PAUSED state
              setIsRunning(true);
              setIsPaused(true);
              setElapsed(accumulated);
              // No tick — timer frozen
            } else if (data.clock_in) {
              // WORKING state
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
      } catch (e) {
        console.error("Time tracking init error:", e);
      } finally {
        setLoading(false);
      }
    };
    init();
    loadTodayHours();

    return () => stopTick();
  }, [startTick, stopTick]);

  const loadTodayHours = async () => {
    try {
      const res = await apiFetch("/time-tracking/history");
      if (!res.ok) return;
      const entries = await res.json();
      const today = new Date().toISOString().slice(0, 10);
      const todayEntry = entries.find((e: any) => e.date === today);
      if (todayEntry && todayEntry.total_hours != null) {
        setTodayHours(parseFloat(Number(todayEntry.total_hours).toFixed(2)));
      } else {
        setTodayHours(0);
      }
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
        setAccumulatedSecs(0);
        setIsRunning(true);
        setIsPaused(false);
        startTick(clockIn, 0);
      } else {
        const err = await res.json();
        await showAlert(err.detail || "Failed to start", { title: "Couldn't start work" });
      }
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  // ── Pause Work ──────────────────────────────────────────────────────────────
  const handlePause = async (ev: React.MouseEvent) => {
    ev.stopPropagation();
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
      } else {
        const err = await res.json();
        await showAlert(err.detail || "Failed to pause", { title: "Couldn't pause work" });
      }
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  // ── Resume Work ─────────────────────────────────────────────────────────────
  const handleResume = async (ev: React.MouseEvent) => {
    ev.stopPropagation();
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
      } else {
        const err = await res.json();
        await showAlert(err.detail || "Failed to resume", { title: "Couldn't resume work" });
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
        stopTick();
        setIsRunning(false);
        setIsPaused(false);
        setElapsed(0);
        setAccumulatedSecs(0);
        setClockInTime(null);
        setIsCompleted(true);
        await loadTodayHours();
      } else {
        const err = await res.json();
        await showAlert(err.detail || "Failed to end", { title: "Couldn't end work" });
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

  // Determine status text and color
  const statusText = isPaused ? "Paused" : isRunning ? "Live" : null;
  const statusColor = isPaused
    ? "text-amber-600 bg-amber-50"
    : "text-green-600 bg-green-50";

  return (
    <div
      className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm h-full w-full flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-semibold text-gray-800">Time Tracking</h3>
        <div className="flex items-center gap-2">
          {statusText && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor} ${!isPaused ? "animate-pulse" : ""}`}>
              {statusText}
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
            <h1 className={`text-5xl font-bold tracking-tight font-mono ${
              isPaused ? "text-amber-500" : isRunning ? "text-[#F2924E]" : "text-gray-900"
            }`}>
              {fmt(elapsed)}
            </h1>
            <p className="text-gray-400 text-sm mt-2">
              {isCompleted 
                ? "Work day completed"
                : isPaused
                  ? "Work paused"
                  : isRunning
                    ? `Clocked in at ${clockInDisplay}`
                    : "Not clocked in"}
            </p>

            {/* Buttons based on state */}
            {isCompleted ? (
              <button
                disabled
                className="mt-5 bg-gray-100 text-gray-500 px-8 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium w-full justify-center transition cursor-not-allowed"
              >
                Day Ended
              </button>
            ) : !isRunning ? (
              /* NOT CLOCKED IN → Start Work */
              <button
                onClick={handleStart}
                disabled={busy}
                className="mt-5 bg-[#F2924E] hover:bg-[#e4833f] disabled:opacity-50 text-white px-8 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium w-full justify-center transition"
              >
                <Play size={14} fill="white" /> Start Work
              </button>
            ) : isPaused ? (
              /* PAUSED → Resume + End */
              <div className="flex gap-2 mt-5 w-full">
                <button
                  onClick={handleResume}
                  disabled={busy}
                  className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium justify-center transition"
                >
                  <RotateCcw size={14} /> Resume
                </button>
                <button
                  onClick={handleEnd}
                  disabled={busy}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium justify-center transition"
                >
                  <StopCircle size={14} /> End
                </button>
              </div>
            ) : (
              /* WORKING → Pause + End */
              <div className="flex gap-2 mt-5 w-full">
                <button
                  onClick={handlePause}
                  disabled={busy}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium justify-center transition"
                >
                  <Pause size={14} /> Pause
                </button>
                <button
                  onClick={handleEnd}
                  disabled={busy}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium justify-center transition"
                >
                  <StopCircle size={14} /> End
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">
        <div className="flex gap-1.5 items-center">
          <span className="text-xs text-gray-400">Today:</span>
          <span className="font-bold text-gray-800">
            {todayHours !== null ? `${todayHours.toFixed(1)}h` : "—"}
          </span>
        </div>
        <button 
          onClick={() => router.push("/dashboard/time-tracking")}
          className="text-[#f2924e] text-[10px] font-bold uppercase tracking-wider hover:underline"
        >
          View All
        </button>
      </div>
    </div>
  );
}
