"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Play, StopCircle, Clock, CheckCircle2, AlertCircle, CalendarDays } from "lucide-react";

const timeEntries = [
  { date: "Thu, Feb 5",  checkIn: "8:47 AM",  checkOut: "5:32 PM",  total: "8h 45m", overtime: "+0h 45m", status: "complete" },
  { date: "Wed, Feb 4",  checkIn: "9:02 AM",  checkOut: "6:15 PM",  total: "9h 13m", overtime: "+1h 13m", status: "complete" },
  { date: "Tue, Feb 3",  checkIn: "8:30 AM",  checkOut: "5:00 PM",  total: "8h 30m", overtime: "+0h 30m", status: "complete" },
  { date: "Mon, Feb 2",  checkIn: "8:55 AM",  checkOut: "5:45 PM",  total: "8h 50m", overtime: "+0h 50m", status: "complete" },
  { date: "Sun, Feb 1",  checkIn: "9:15 AM",  checkOut: "6:00 PM",  total: "8h 45m", overtime: "+0h 45m", status: "complete" },
];

const stats = [
  { label: "Total Hours",    value: "44h 3m",  sub: "This week",     icon: Clock,         iconColor: "text-blue-500",   bg: "bg-blue-50"   },
  { label: "Regular Hours",  value: "40h",     sub: "Standard time", icon: CheckCircle2,  iconColor: "text-green-500",  bg: "bg-green-50"  },
  { label: "Overtime",       value: "4h 3m",   sub: "Extra hours",   icon: AlertCircle,   iconColor: "text-orange-500", bg: "bg-orange-50" },
  { label: "Avg Check-in",   value: "8:54 AM", sub: "This week",     icon: CalendarDays,  iconColor: "text-purple-500", bg: "bg-purple-50" },
];

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TimeTrackingPage() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  const handleToggle = () => {
    if (!isRunning) {
      setElapsed(0);
    }
    setIsRunning((r) => !r);
  };

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
        <p className="text-sm text-gray-500 mt-1">Track your work hours, view clock-in/out history, and manage overtime</p>
      </div>

      {/* Current Status Banner */}
      <div className="bg-[#F2924E] rounded-2xl px-8 py-6 flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium mb-1">Current Status</p>
          <h2 className="text-5xl font-bold text-white tracking-tight font-mono">
            {formatElapsed(elapsed)}
          </h2>
          <p className="text-white/70 text-sm mt-2">Last clocked in at 8:47 AM</p>
        </div>

        <button
          onClick={handleToggle}
          className="bg-white text-gray-800 hover:bg-gray-50 transition px-6 py-3 rounded-xl flex items-center gap-2 font-semibold text-sm shadow"
        >
          {isRunning ? (
            <><StopCircle size={16} className="text-orange-500" /> End Work</>
          ) : (
            <><Play size={16} className="text-[#F2924E]" fill="#F2924E" /> Start Work</>
          )}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-5">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <Icon size={16} className={s.iconColor} />
                </div>
                <span className="text-sm text-gray-500">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Time Entries Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4">
          <h3 className="text-base font-semibold text-gray-800">Time Entries</h3>
          <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 outline-none">
            <option>This week</option>
            <option>Last week</option>
            <option>This month</option>
          </select>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-gray-100">
              {["DATE", "CHECK IN", "CHECK OUT", "TOTAL HOURS", "OVERTIME", "STATUS"].map((h) => (
                <th key={h} className="text-left text-xs text-gray-400 font-medium px-6 py-3 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeEntries.map((row, i) => (
              <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 transition">
                <td className="px-6 py-4 text-gray-700">{row.date}</td>
                <td className="px-6 py-4 text-gray-600">{row.checkIn}</td>
                <td className="px-6 py-4 text-gray-600">{row.checkOut}</td>
                <td className="px-6 py-4 font-semibold text-gray-900">{row.total}</td>
                <td className="px-6 py-4 text-orange-500 font-medium">{row.overtime}</td>
                <td className="px-6 py-4">
                  <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}