"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { ATTENDANCE_VIEW_OTHERS } from "@/lib/permissions";
import { ChevronLeft, ChevronRight, Search, Clock, ShieldAlert } from "lucide-react";

interface AttendanceItem {
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  employee_id: string | null;
  department: string | null;
  role: string | null;
  total_hours: number;
  overtime: number;
}

export default function AttendancePage() {
  const { user, hasPermission, loading: authLoading } = useAuth();
  const router = useRouter();

  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  const [offset, setOffset] = useState(0);
  
  const [items, setItems] = useState<AttendanceItem[]>([]);
  const [dateLabel, setDateLabel] = useState("");
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  
  // Sort: "desc" (High -> Low) or "asc" (Low -> High)
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else if (!hasPermission(ATTENDANCE_VIEW_OTHERS)) {
        router.push("/dashboard"); // unauthorized
      }
    }
  }, [user, authLoading, hasPermission, router]);

  useEffect(() => {
    if (authLoading || !user || !hasPermission(ATTENDANCE_VIEW_OTHERS)) return;

    let isMounted = true;
    const fetchAttendance = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/time-tracking/all-attendance?period=${period}&offset=${offset}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        
        if (isMounted) {
          setItems(data.items || []);
          
          // Format date label based on period
          const start = new Date(data.start_date + "T00:00:00");
          const end = new Date(data.end_date + "T00:00:00");
          
          if (period === "day") {
            setDateLabel(start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }));
          } else if (period === "week") {
            setDateLabel(`${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`);
          } else {
            setDateLabel(start.toLocaleDateString("en-US", { month: "long", year: "numeric" }));
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAttendance();
    return () => { isMounted = false; };
  }, [period, offset, user, authLoading, hasPermission]);

  if (authLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!user || !hasPermission(ATTENDANCE_VIEW_OTHERS)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-red-50 p-4 rounded-full mb-4">
          <ShieldAlert className="text-red-500" size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500 max-w-md">You do not have permission to view others' attendance records.</p>
      </div>
    );
  }

  // Derived filter options
  const departments = ["All", ...Array.from(new Set(items.map(i => i.department).filter(Boolean)))].sort();
  const roles = ["All", ...Array.from(new Set(items.map(i => i.role).filter(Boolean)))].sort();

  // Apply filters and search
  const filtered = items.filter(item => {
    if (deptFilter !== "All" && item.department !== deptFilter) return false;
    if (roleFilter !== "All" && item.role !== roleFilter) return false;
    
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = `${item.first_name || ""} ${item.last_name || ""}`.toLowerCase();
      const empId = (item.employee_id || "").toLowerCase();
      const dept = (item.department || "").toLowerCase();
      const r = (item.role || "").toLowerCase();
      
      return name.includes(q) || empId.includes(q) || dept.includes(q) || r.includes(q);
    }
    return true;
  });

  // Apply sort
  filtered.sort((a, b) => {
    if (sortOrder === "desc") {
      return b.total_hours - a.total_hours;
    } else {
      return a.total_hours - b.total_hours;
    }
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-3 transition"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">Attendance Overview</h1>
          <p className="text-sm text-gray-500 mt-1">View and filter employee attendance records.</p>
        </div>
        
        {/* Period Navigation */}
        <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm p-1">
          <div className="flex border-r border-gray-100 pr-2 mr-2">
            <button
              onClick={() => { setPeriod("day"); setOffset(0); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${period === "day" ? "bg-[#F2924E] text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              Day
            </button>
            <button
              onClick={() => { setPeriod("week"); setOffset(0); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${period === "week" ? "bg-[#F2924E] text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              Week
            </button>
            <button
              onClick={() => { setPeriod("month"); setOffset(0); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${period === "month" ? "bg-[#F2924E] text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              Month
            </button>
          </div>
          
          <div className="flex items-center gap-2 px-2">
            <button onClick={() => setOffset(o => o - 1)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition">
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">
              {dateLabel}
            </span>
            <button 
              onClick={() => setOffset(o => o + 1)} 
              disabled={offset === 0}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row gap-4 items-end">
        
        {/* Search */}
        <div className="flex-1 w-full relative">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Name, ID, Department, Role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F2924E]/20 focus:border-[#F2924E] transition"
            />
          </div>
        </div>

        <div className="flex gap-4 w-full lg:w-auto">
          {/* Department Filter */}
          <div className="flex-1 lg:w-40">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Department</label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F2924E]/20 focus:border-[#F2924E] bg-white transition"
            >
              {departments.map(d => <option key={d as string} value={d as string}>{d}</option>)}
            </select>
          </div>

          {/* Role Filter */}
          <div className="flex-1 lg:w-40">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F2924E]/20 focus:border-[#F2924E] bg-white transition"
            >
              {roles.map(r => <option key={r as string} value={r as string}>{r}</option>)}
            </select>
          </div>

          {/* Sort Order */}
          <div className="flex-1 lg:w-48">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Sort by Hours</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F2924E]/20 focus:border-[#F2924E] bg-white transition"
            >
              <option value="desc">High to Low</option>
              <option value="asc">Low to High</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
                  <div 
                    className="inline-flex items-center gap-1 cursor-pointer hover:text-gray-700 transition"
                    onClick={() => setSortOrder(s => s === "desc" ? "asc" : "desc")}
                  >
                    Total Hours
                    <span className="text-[10px] bg-gray-200 text-gray-600 px-1 rounded">
                      {sortOrder === "desc" ? "↓" : "↑"}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Overtime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center">
                    <div className="inline-flex items-center gap-2 text-gray-400">
                      <div className="w-4 h-4 border-2 border-[#F2924E] border-t-transparent rounded-full animate-spin" />
                      Loading attendance data...
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <Clock size={32} className="mx-auto mb-3 text-gray-300" />
                    <p className="font-medium text-gray-900">No attendance records found</p>
                    <p className="text-sm mt-1">Try adjusting your filters or search query.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.user_id} className="hover:bg-orange-50/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs shrink-0">
                          {item.first_name?.[0] || item.last_name?.[0] || "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {item.first_name} {item.last_name}
                          </p>
                          <p className="text-xs text-gray-500">{item.employee_id || "No ID"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {item.department || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {item.role || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                      {item.total_hours.toFixed(2)}h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                      {item.overtime > 0 ? (
                        <span className="text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full text-xs">
                          +{item.overtime.toFixed(2)}h
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
