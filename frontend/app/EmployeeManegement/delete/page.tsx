"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconArrowLeft, IconTrash } from "../../components/icons";

// Hardcoded data for demonstration
const EMPLOYEES = [
  { id: "#EMP-001", name: "John Doe",        department: "Human Resources", designation: "Senior Developer",    status: "active" },
  { id: "#EMP-002", name: "Sarah Smith",     department: "Design",          designation: "UI Engineer",         status: "active" },
  { id: "#EMP-003", name: "Michael Chen",    department: "Marketing",       designation: "Marketing Lead",      status: "active" },
  { id: "#EMP-004", name: "Elena",           department: "Human Resources", designation: "HR Manager",          status: "active" },
  { id: "#EMP-005", name: "David Wilson",    department: "Human Resources", designation: "HR Manager",          status: "inactive" },
];

export default function DeleteEmployeePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const empId = searchParams.get("id");

  const [isDeleting, setIsDeleting] = useState(false);

  const employee = EMPLOYEES.find((emp) => emp.id === empId) || {
    id: empId || "Unknown ID",
    name: "Unknown Employee",
    department: "-",
    designation: "-",
  };

  const handleDelete = () => {
    setIsDeleting(true);
    // Simulate API call
    setTimeout(() => {
      console.log(`Deleted employee ${empId}`);
      router.push("/");
    }, 800);
  };

  return (
    <div className="max-w-[700px] mx-auto pb-20 pt-10">
      {/* Header / Back Navigation */}
      <div className="mb-8">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-[14px] text-gray-500 hover:text-gray-800 transition-colors mb-4 font-medium"
        >
          <IconArrowLeft />
          Back to Employee List
        </Link>
        <h1 className="text-[28px] font-bold text-[#212B36]">Delete Employee</h1>
        <p className="text-[14px] text-gray-400 mt-1">Remove employee from the system</p>
      </div>

      <div className="bg-white rounded-xl border border-red-100 shadow-sm p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
            <IconTrash />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-gray-900">Are you absolutely sure?</h2>
            <p className="text-[14px] text-gray-500 mt-1">
              This action cannot be undone. This will permanently delete the employee record.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-8">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[12px] font-bold text-gray-400 uppercase">Employee ID</p>
              <p className="text-[14px] font-medium text-gray-900 mt-1">{employee.id}</p>
            </div>
            <div>
              <p className="text-[12px] font-bold text-gray-400 uppercase">Name</p>
              <p className="text-[14px] font-medium text-gray-900 mt-1">{employee.name}</p>
            </div>
            <div>
              <p className="text-[12px] font-bold text-gray-400 uppercase">Department</p>
              <p className="text-[14px] font-medium text-gray-900 mt-1">{employee.department}</p>
            </div>
            <div>
              <p className="text-[12px] font-bold text-gray-400 uppercase">Designation</p>
              <p className="text-[14px] font-medium text-gray-900 mt-1">{employee.designation}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link 
            href="/"
            className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium text-[14px] hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button 
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-6 py-2.5 rounded-xl bg-red-500 text-white font-medium text-[14px] hover:bg-red-600 shadow-sm hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isDeleting ? "Deleting..." : "Yes, Delete Employee"}
          </button>
        </div>
      </div>
    </div>
  );
}
