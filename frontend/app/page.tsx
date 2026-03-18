"use client";

import React, { useState } from "react";
import Link from "next/link";
import { IconSearch, IconChevron, IconEye, IconEdit, IconTrash } from "./components/icons";

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

const EMPLOYEES = [
  { id: "#EMP-001", name: "John Doe",        department: "Human Resources", designation: "Senior Developer",    status: "active" },
  { id: "#EMP-002", name: "Sarah Smith",     department: "Design",          designation: "UI Engineer",         status: "active" },
  { id: "#EMP-003", name: "Michael Chen",    department: "Marketing",       designation: "Marketing Lead",      status: "active" },
  { id: "#EMP-004", name: "Elena",           department: "Human Resources", designation: "HR Manager",          status: "active" },
  { id: "#EMP-005", name: "David Wilson",    department: "Human Resources", designation: "HR Manager",          status: "inactive" },
  { id: "#EMP-006", name: "Amy Johnson",     department: "Design",          designation: "UX Designer",         status: "active" },
  { id: "#EMP-007", name: "James Anderson",  department: "Engineering",     designation: "Backend Developer",   status: "active" },
  { id: "#EMP-008", name: "Lisa Park",       department: "Marketing",       designation: "Content Strategist",  status: "active" },
  { id: "#EMP-009", name: "Robert Taylor",   department: "Engineering",     designation: "DevOps Engineer",     status: "inactive" },
  { id: "#EMP-010", name: "Nina Patel",      department: "Design",          designation: "Product Designer",    status: "active" },
  { id: "#EMP-011", name: "Chris Evans",     department: "Engineering",     designation: "Frontend Developer",  status: "active" },
  { id: "#EMP-012", name: "Maria Garcia",    department: "Human Resources", designation: "Recruiter",           status: "active" },
  { id: "#EMP-013", name: "Tom Harris",      department: "Marketing",       designation: "SEO Specialist",      status: "inactive" },
  { id: "#EMP-014", name: "Rachel Kim",      department: "Design",          designation: "Graphic Designer",    status: "active" },
  { id: "#EMP-015", name: "Kevin Brown",     department: "Engineering",     designation: "QA Engineer",         status: "active" },
  { id: "#EMP-016", name: "Sophie Turner",   department: "Human Resources", designation: "Training Manager",    status: "active" },
  { id: "#EMP-017", name: "Alex Martinez",   department: "Engineering",     designation: "Senior Developer",    status: "active" },
  { id: "#EMP-018", name: "Emily Davis",     department: "Marketing",       designation: "Brand Manager",       status: "inactive" },
  { id: "#EMP-019", name: "Daniel Lee",      department: "Engineering",     designation: "System Architect",    status: "active" },
  { id: "#EMP-020", name: "Olivia White",    department: "Design",          designation: "UI Engineer",         status: "active" },
];

export default function EmployeeManagementPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [role, setRole] = useState("all");

  const filteredEmployees = EMPLOYEES.filter((emp) => {
    const matchesSearch =
      searchQuery === "" ||
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = department === "all" || emp.department === department;
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
          <option value="Design">Design</option>
          <option value="Marketing">Marketing</option>
          <option value="Engineering">Engineering</option>
        </FilterSelect>
        <FilterSelect className="w-36" value={role} onChange={setRole}>
          <option value="all">All Roles</option>
          <option value="Senior Developer">Senior Developer</option>
          <option value="UI Engineer">UI Engineer</option>
          <option value="HR Manager">HR Manager</option>
          <option value="Marketing Lead">Marketing Lead</option>
          <option value="UX Designer">UX Designer</option>
          <option value="Backend Developer">Backend Developer</option>
          <option value="Frontend Developer">Frontend Developer</option>
          <option value="DevOps Engineer">DevOps Engineer</option>
          <option value="QA Engineer">QA Engineer</option>
          <option value="Product Designer">Product Designer</option>
          <option value="Graphic Designer">Graphic Designer</option>
          <option value="System Architect">System Architect</option>
          <option value="Recruiter">Recruiter</option>
          <option value="Training Manager">Training Manager</option>
          <option value="Content Strategist">Content Strategist</option>
          <option value="SEO Specialist">SEO Specialist</option>
          <option value="Brand Manager">Brand Manager</option>
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
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-5 text-sm font-bold text-[#212B36]">{emp.id}</td>
                  <td className="px-6 py-5 text-sm text-gray-600">{emp.name}</td>
                  <td className="px-6 py-5 text-sm text-gray-500">{emp.department}</td>
                  <td className="px-6 py-5 text-sm text-gray-500">{emp.designation}</td>
                  <td className="px-6 py-5">
                    <span className={`inline-block px-4 py-1 rounded-full text-[11px] font-bold tracking-wider ${
                      emp.status === "active"
                        ? "bg-[#F9A15D] text-white"
                        : "bg-[#919EAB] text-white"
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-end gap-4 text-gray-400">
                      <Link href={`/EmployeeManegement/view?id=${encodeURIComponent(emp.id)}`} className="hover:text-gray-600 transition-colors" aria-label="View">
                        <IconEye />
                      </Link>
                      <Link href={`/EmployeeManegement/edit?id=${encodeURIComponent(emp.id)}`} className="hover:text-gray-600 transition-colors" aria-label="Edit">
                        <IconEdit />
                      </Link>
                      <Link href={`/EmployeeManegement/delete?id=${encodeURIComponent(emp.id)}`} className="hover:text-red-500 transition-colors" aria-label="Delete">
                        <IconTrash />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Button */}
      <div className="mt-6 flex justify-end">
        <Link 
          href="/EmployeeManegement/add"
          className="inline-flex items-center gap-2 bg-[#EE7F22] hover:bg-[#d66f1b] text-white font-semibold px-6 py-3 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Employee
        </Link>
      </div>
    </div>
  );
}