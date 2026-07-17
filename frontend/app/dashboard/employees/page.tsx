"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { IconSearch, IconChevron, IconEye, IconEdit, IconTrash } from "@/components/Icons";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import DeleteEmployeeModal, { DeletableEmployee } from "@/components/DeleteEmployeeModal";

interface FilterSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

function FilterSelect({ value, onChange, children, className = "" }: FilterSelectProps) {
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="appearance-none w-full bg-white border border-gray-200 rounded-lg pl-4 pr-9 py-2.5 text-sm text-gray-600 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] transition"
      >
        {children}
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <IconChevron />
      </span>
    </div>
  );
}

function getInitials(first: string, last: string) {
  return `${(first?.[0] || "").toUpperCase()}${(last?.[0] || "").toUpperCase()}`;
}

const avatarColors = [
  "bg-orange-100 text-orange-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-teal-100 text-teal-700",
];

function getAvatarColor(id: number) {
  return avatarColors[id % avatarColors.length];
}

interface Employee {
  id: number;
  user_id?: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  department_rel?: { id: number; name: string };
  designation: string;
  status: string;
}

export default function EmployeeManagementPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [role, setRole] = useState("all");
  const [employeeToDelete, setEmployeeToDelete] = useState<DeletableEmployee | null>(null);
  const [sortBy, setSortBy] = useState("name_az");

  const { hasPermission, user } = useAuth();

  const fetchEmployees = async () => {
    try {
      const data = await api.get<Employee[]>("/employees/");
      setEmployees(data);
    } catch (error) {
      console.error("Failed to fetch employees:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    api.get<{ id: number; name: string }[]>("/departments/")
      .then((data) => setDepartments(data))
      .catch((err) => console.error("Failed to fetch departments:", err));
  }, []);

  const filteredEmployees = useMemo(() => {
    let list = employees.filter((emp) => {
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
      const matchesSearch =
        searchQuery === "" ||
        fullName.includes(searchQuery.toLowerCase()) ||
        (emp.employee_id?.toLowerCase() || "").includes(searchQuery.toLowerCase());
      const matchesDept = department === "all" || emp.department_rel?.name === department;
      const matchesRole = role === "all" || emp.designation === role;
      return matchesSearch && matchesDept && matchesRole;
    });

    switch (sortBy) {
      case "name_az":
        list = [...list].sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
        break;
      case "name_za":
        list = [...list].sort((a, b) => `${b.first_name} ${b.last_name}`.localeCompare(`${a.first_name} ${a.last_name}`));
        break;
      case "emp_id":
        list = [...list].sort((a, b) => (a.employee_id || "").localeCompare(b.employee_id || ""));
        break;
      case "department":
        list = [...list].sort((a, b) => (a.department_rel?.name || "").localeCompare(b.department_rel?.name || ""));
        break;
      case "designation":
        list = [...list].sort((a, b) => (a.designation || "").localeCompare(b.designation || ""));
        break;
      case "status_active":
        list = [...list].sort((a, b) => (a.status === "active" ? -1 : 1) - (b.status === "active" ? -1 : 1));
        break;
      case "status_inactive":
        list = [...list].sort((a, b) => (a.status !== "active" ? -1 : 1) - (b.status !== "active" ? -1 : 1));
        break;
      case "id_asc":
        list = [...list].sort((a, b) => a.id - b.id);
        break;
      case "id_desc":
        list = [...list].sort((a, b) => b.id - a.id);
        break;
      default:
        break;
    }

    return list;
  }, [employees, searchQuery, department, role, sortBy]);

  const activeCount = employees.filter(e => e.status === "active").length;
  const inactiveCount = employees.filter(e => e.status !== "active").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your workforce and system access</p>
        </div>
        {hasPermission("employee:create") && (
          <Link
            href="/dashboard/EmployeeManagement/add"
            className="inline-flex items-center gap-2 bg-[#EE7F22] hover:bg-[#d66f1b] text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add Employee
          </Link>
        )}
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Employees</p>
          <p className="text-3xl font-bold text-gray-900">{loading ? "—" : employees.length}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Active</p>
          <p className="text-3xl font-bold text-[#F9A15D]">{loading ? "—" : activeCount}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Inactive</p>
          <p className="text-3xl font-bold text-gray-400">{loading ? "—" : inactiveCount}</p>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-3 p-5 border-b border-gray-100">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              <IconSearch />
            </span>
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] transition focus:bg-white"
            />
          </div>
          <FilterSelect className="w-48" value={department} onChange={setDepartment}>
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </FilterSelect>
          <FilterSelect className="w-36" value={role} onChange={setRole}>
            <option value="all">All Roles</option>
          </FilterSelect>
          <FilterSelect className="w-44" value={sortBy} onChange={setSortBy}>
            <option value="name_az">Sort: Name A → Z</option>
            <option value="name_za">Sort: Name Z → A</option>
            <option value="emp_id">Sort: Employee ID</option>
            <option value="department">Sort: Department</option>
            <option value="designation">Sort: Designation</option>
            <option value="status_active">Sort: Active First</option>
            <option value="status_inactive">Sort: Inactive First</option>
            <option value="id_asc">Sort: Oldest Added</option>
            <option value="id_desc">Sort: Newest Added</option>
          </FilterSelect>
          <div className="ml-auto text-sm text-gray-400 font-medium whitespace-nowrap">
            {loading ? "" : `${filteredEmployees.length} of ${employees.length} employees`}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100">
                <th className="text-left px-6 py-3.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Employee</th>
                <th className="text-left px-6 py-3.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Department</th>
                <th className="text-left px-6 py-3.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Designation</th>
                <th className="text-left px-6 py-3.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-3.5 text-right text-[11px] font-bold text-gray-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <>
                  {Array.from({ length: 6 }).map((_, ri) => (
                    <tr key={ri} aria-hidden="true">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="skeleton-shimmer h-9 w-9 rounded-full flex-shrink-0" />
                          <div className="space-y-1.5">
                            <div className="skeleton-shimmer h-3.5 w-32 rounded" />
                            <div className="skeleton-shimmer h-3 w-20 rounded" />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4"><div className="skeleton-shimmer h-3.5 w-28 rounded" /></td>
                      <td className="px-6 py-4"><div className="skeleton-shimmer h-3.5 w-24 rounded" /></td>
                      <td className="px-6 py-4"><div className="skeleton-shimmer h-5 w-16 rounded-full" /></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <div className="skeleton-shimmer h-7 w-7 rounded-lg" />
                          <div className="skeleton-shimmer h-7 w-7 rounded-lg" />
                          <div className="skeleton-shimmer h-7 w-7 rounded-lg" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      </div>
                      <p className="text-sm font-medium text-gray-500">No employees found</p>
                      <p className="text-xs text-gray-400">Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-orange-50/20 transition-colors group border-b border-gray-50 last:border-0">
                    {/* Employee cell */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${getAvatarColor(emp.id)}`}>
                          {getInitials(emp.first_name, emp.last_name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 leading-snug">{emp.first_name} {emp.last_name}</p>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5">{emp.employee_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {emp.department_rel?.name ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-[12px] font-medium">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                          {emp.department_rel.name}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {emp.designation ? (
                        <span className="text-[13px] text-gray-600 font-medium">{emp.designation}</span>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        emp.status === "active"
                          ? "bg-[#EE7F22]/10 text-[#EE7F22] border border-[#F9A15D]/40"
                          : "bg-gray-100 text-gray-500 border border-gray-200"
                      }`}>
                        <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${emp.status === "active" ? "bg-[#EE7F22]" : "bg-gray-400"}`} />
                        <span className="leading-none pt-[1px]">{emp.status === "active" ? "Active" : "Inactive"}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/dashboard/EmployeeManagement/view?id=${emp.id}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#EE7F22] hover:bg-[#EE7F22]/10 transition-colors"
                          aria-label="View"
                          title="View"
                        >
                          <IconEye />
                        </Link>
                        {hasPermission("employee:update") && emp.user_id !== user?.id && (
                          <Link
                            href={`/dashboard/EmployeeManagement/edit?id=${emp.id}`}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#EE7F22] hover:bg-orange-50 transition-colors"
                            aria-label="Edit"
                            title="Edit"
                          >
                            <IconEdit />
                          </Link>
                        )}
                        {hasPermission("employee:delete") && emp.user_id !== user?.id && (
                          <button
                            type="button"
                            onClick={() => setEmployeeToDelete({
                              id: emp.id,
                              employee_id: emp.employee_id,
                              first_name: emp.first_name,
                              last_name: emp.last_name,
                              department: emp.department_rel?.name,
                              designation: emp.designation,
                              status: emp.status,
                            })}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            aria-label="Delete"
                            title="Delete"
                          >
                            <IconTrash />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        {!loading && filteredEmployees.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-50 bg-gray-50/50">
            <p className="text-xs text-gray-400">
              Showing <span className="font-semibold text-gray-600">{filteredEmployees.length}</span> employee{filteredEmployees.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      {employeeToDelete && (
        <DeleteEmployeeModal
          employee={employeeToDelete}
          onClose={() => setEmployeeToDelete(null)}
          onDeleted={() => {
            setEmployeeToDelete(null);
            fetchEmployees();
          }}
        />
      )}
    </div>
  );
}
