"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconArrowLeft, IconTrash } from "@/components/Icons";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface Employee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  department: string;
  designation: string;
}

function DeleteEmployeeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const { hasPermission, loading: authLoading } = useAuth();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !hasPermission("employee:delete")) {
      router.replace("/dashboard/employees");
    }
  }, [authLoading, hasPermission, router]);

  useEffect(() => {
    if (!id) return;
    const fetchEmployee = async () => {
      try {
        const data = await api.get<Employee>(`/employees/${id}`);
        setEmployee(data);
      } catch (error) {
        console.error("Failed to fetch employee:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await api.delete(`/employees/${id}`);
      router.push("/dashboard/employees");
    } catch (error) {
      console.error("Failed to delete employee:", error);
      alert("Failed to delete employee.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Loading employee details...</div>;
  if (!employee) return <div className="p-10 text-center text-red-500">Employee not found.</div>;

  return (
    <div className="max-w-[700px] mx-auto pb-20 pt-10">
      {/* Header / Back Navigation */}
      <div className="mb-8">
        <Link 
          href="/dashboard/employees" 
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
              <p className="text-[14px] font-medium text-gray-900 mt-1">{employee.employee_id}</p>
            </div>
            <div>
              <p className="text-[12px] font-bold text-gray-400 uppercase">Name</p>
              <p className="text-[14px] font-medium text-gray-900 mt-1">{employee.first_name} {employee.last_name}</p>
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
            href="/dashboard/employees"
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

export default function DeleteEmployeePage() {
  return (
    <React.Suspense fallback={<div className="p-10 text-center text-gray-400">Loading delete details...</div>}>
      <DeleteEmployeeContent />
    </React.Suspense>
  );
}
