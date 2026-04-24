"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { IconSearch, IconChevron, IconEye, IconEdit, IconTrash } from "@/components/icons";
import { api } from "@/lib/api";

/**
 * Reusable Select Filter component with custom chevron
 */
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
        className="appearance-none w-full bg-white border border-gray-200 rounded-lg pl-4 pr-10 py-2 text-sm text-gray-500 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-100 transition"
      >
        {children}
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <IconChevron />
      </span>
    </div>
  );
}

interface Employee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  department_rel?: { id: number; name: string };
  designation: string;
  status: string;
}

export default function EmployeeManagementPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [role, setRole] = useState("all");

  useEffect(() => {
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
    fetchEmployees();
  }, []);

  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    const matchesSearch =
      searchQuery === "" ||
      fullName.includes(searchQuery.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = department === "all" || emp.department_rel?.name === department;
    const matchesRole = role === "all" || emp.designation === role;
    return matchesSearch && matchesDept && matchesRole;
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#212B36]">Employee Management</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage employees and their system access</p>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <IconSearch />
          </span>
          <input
            type="text"
            placeholder="search by name id"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </div>
        <FilterSelect className="w-44" value={department} onChange={setDepartment}>
          <option value="all">All Departments</option>
          <option value="Human Resources">Human Resources</option>
          <option value="Engineering">Engineering</option>
          <option value="Design">Design</option>
          <option value="Marketing">Marketing</option>
          <option value="Sales">Sales</option>
          <option value="Finance">Finance</option>
          <option value="Operations">Operations</option>
        </FilterSelect>
        <FilterSelect className="w-36" value={role} onChange={setRole}>
          <option value="all">All Roles</option>
        </FilterSelect>
      </div>

      {/* Scrollable Table */}
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <div className="max-h-[480px] overflow-y-auto scrollbar-thin">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#F9FAFB] border-b border-gray-100">
                <th className="text-left px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Employee ID</th>
                <th className="text-left px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Name</th>
                <th className="text-left px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Department</th>
                <th className="text-left px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Designation</th>
                <th className="text-left px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400">Loading employees...</td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400">No employees found</td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-5 text-sm font-bold text-[#212B36]">{emp.employee_id}</td>
                    <td className="px-6 py-5 text-sm text-gray-600">{emp.first_name} {emp.last_name}</td>
                    <td className="px-6 py-5 text-sm text-gray-500">{emp.department_rel?.name || "N/A"}</td>
                    <td className="px-6 py-5 text-sm text-gray-500">{emp.designation}</td>
                    <td className="px-6 py-5">
                      <span className={`inline-block px-4 py-1 rounded-full text-[11px] font-bold tracking-wider ${emp.status === "active"
                        ? "bg-[#F9A15D] text-white"
                        : "bg-[#919EAB] text-white"
                        }`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-4 text-gray-400">
                        <Link href={`/dashboard/EmployeeManagement/view?id=${emp.id}`} className="hover:text-gray-600 transition-colors" aria-label="View">
                          <IconEye />
                        </Link>
                        <Link href={`/dashboard/EmployeeManagement/edit?id=${emp.id}`} className="hover:text-gray-600 transition-colors" aria-label="Edit">
                          <IconEdit />
                        </Link>
                        <Link href={`/dashboard/EmployeeManagement/delete?id=${emp.id}`} className="hover:text-red-500 transition-colors" aria-label="Delete">
                          <IconTrash />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Button */}
      <div className="mt-6 flex justify-end">
        <Link
          href="/dashboard/EmployeeManagement/add"
          className="inline-flex items-center gap-2 bg-[#EE7F22] hover:bg-[#d66f1b] text-white font-semibold px-6 py-3 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add Employee
        </Link>
      </div>
    </div>
  );
}
