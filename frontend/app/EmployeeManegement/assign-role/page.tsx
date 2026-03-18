"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconArrowLeft, IconChevron } from "../../components/icons";

// Roles and their read-only permissions for the "Select Existing Role" flow
const SYSTEM_ROLES = [
  {
    id: "employee",
    name: "Employee",
    description: "Standard access for regular staff members",
    permissions: {
      "Employee Management": ["View Own Profile", "Edit Own Profile"],
      "Leave Management": ["View Own Leaves", "Apply Leave", "Cancel Own Leave"],
      "Document Management": ["View Own Documents", "Upload Documents"],
    },
  },
  {
    id: "manager",
    name: "Manager",
    description: "Advanced access for team leads and department heads",
    permissions: {
      "Employee Management": ["View Own Profile", "View All Employees", "Edit Employee Details"],
      "Leave Management": ["View Own Leaves", "Apply Leave", "Cancel Own Leave", "View Team Leaves", "Approve Leave Requests"],
      "Document Management": ["View Own Documents", "Upload Documents", "Request Documents"],
    },
  },
  {
    id: "hr",
    name: "HR",
    description: "Full access to employee management and payroll",
    permissions: {
      "Employee Management": ["View Own Profile", "Edit Own Profile", "View All Employees", "Add Employee", "Edit Employee Details", "Export Employee Data"],
      "Leave Management": ["View Own Leaves", "Apply Leave", "Cancel Own Leave", "View Team Leaves", "Approve Leave Requests", "Reject Leave Requests", "Manage Leave Types"],
      "Document Management": ["View Own Documents", "Upload Documents", "Request Documents", "View All Documents", "Approve Documents"],
    },
  },
  {
    id: "super-admin",
    name: "Super Admin",
    description: "Complete system access and configuration rights",
    permissions: {
      "Employee Management": ["View Own Profile", "Edit Own Profile", "View All Employees", "Add Employee", "Edit Employee Details", "Delete Employee", "Export Employee Data"],
      "Leave Management": ["View Own Leaves", "Apply Leave", "Cancel Own Leave", "View Team Leaves", "Approve Leave Requests", "Reject Leave Requests", "Manage Leave Types"],
      "Document Management": ["View Own Documents", "Upload Documents", "Request Documents", "View All Documents", "Approve Documents", "Generate Documents", "Manage Templates"],
    },
  },
];

// All available permissions for the "Create Custom Role" flow
const ALL_PERMISSIONS = {
  "Employee Management": [
    "View Own Profile",
    "Edit Own Profile",
    "View All Employees",
    "Add Employee",
    "Edit Employee Details",
    "Delete Employee",
    "Export Employee Data",
  ],
  "Leave Management": [
    "View Own Leaves",
    "Apply Leave",
    "Cancel Own Leave",
    "View Team Leaves",
    "Approve Leave Requests",
    "Reject Leave Requests",
    "Manage Leave Types",
  ],
  "Document Management": [
    "View Own Documents",
    "Upload Documents",
    "Request Documents",
    "View All Documents",
    "Approve Documents",
    "Generate Documents",
    "Manage Templates",
  ],
};

export default function AssignRolePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const empId = searchParams.get("id") || "#EMP-001";

  const [assignmentOption, setAssignmentOption] = useState<"existing" | "custom">("existing");
  const [selectedRoleId, setSelectedRoleId] = useState("employee");
  const [customRoleName, setCustomRoleName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const selectedRole = SYSTEM_ROLES.find(r => r.id === selectedRoleId);

  const handleTogglePermission = (perm: string) => {
    setSelectedPermissions(prev => 
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleSave = () => {
    console.log("Saving role assignment", {
      empId,
      assignmentOption,
      selectedRoleId: assignmentOption === "existing" ? selectedRoleId : null,
      customRoleName: assignmentOption === "custom" ? customRoleName : null,
      selectedPermissions: assignmentOption === "custom" ? selectedPermissions : Object.values(selectedRole?.permissions || {}).flat(),
    });
    router.push("/");
  };

  // Helper for Stepper circles
  const StepCircle = ({ num, active, completed }: { num: number; active?: boolean; completed?: boolean }) => (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold transition-all duration-300 ${
      completed ? "bg-[#EE7F22] text-white" : active ? "bg-[#EE7F22] text-white" : "bg-gray-100 text-gray-400"
    }`}>
      {completed ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      ) : num}
    </div>
  );

  return (
    <div className="max-w-[1000px] mx-auto pb-20 pt-2">
      {/* Header / Back Navigation */}
      <div className="mb-8">
        <Link 
          href={`/EmployeeManegement/edit?id=${encodeURIComponent(empId)}`}
          className="inline-flex items-center gap-2 text-[14px] text-gray-500 hover:text-gray-800 transition-colors mb-4 font-medium"
        >
          <IconArrowLeft />
          Back
        </Link>
        <h1 className="text-[28px] font-bold text-[#212B36]">Assign Role & Permissions</h1>
        <p className="text-[14px] text-gray-400 mt-1">Define system access for the employee</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-4 mb-10 px-4">
        <div className="flex items-center gap-3">
          <StepCircle num={1} completed />
          <span className="text-[14px] font-medium text-gray-500">Employee Details</span>
        </div>
        <div className="w-16 h-[2px] bg-[#EE7F22]"></div>
        <div className="flex items-center gap-3">
          <StepCircle num={2} active />
          <span className="text-[14px] font-bold text-[#212B36]">Assign Role & Permissions</span>
        </div>
      </div>

      <div className="space-y-6">
        {/* Assignment Option Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          <h2 className="text-[14px] font-bold text-gray-400 uppercase tracking-wider mb-6">Assignment Option</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label 
              className={`flex items-start gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                assignmentOption === "existing" ? "border-[#EE7F22] bg-[#EE7F22]/5" : "border-gray-100 hover:border-gray-200"
              }`}
            >
              <input 
                type="radio" 
                name="assignmentOption" 
                className="mt-1 accent-[#EE7F22] w-4 h-4" 
                checked={assignmentOption === "existing"}
                onChange={() => setAssignmentOption("existing")}
              />
              <div>
                <p className={`text-[15px] font-bold ${assignmentOption === "existing" ? "text-[#EE7F22]" : "text-[#212B36]"}`}>
                  Select Existing Role
                </p>
                <p className="text-[13px] text-gray-500 mt-1">Choose from predefined roles with preset permissions</p>
              </div>
            </label>

            <label 
              className={`flex items-start gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                assignmentOption === "custom" ? "border-[#EE7F22] bg-[#EE7F22]/5" : "border-gray-100 hover:border-gray-200"
              }`}
            >
              <input 
                type="radio" 
                name="assignmentOption" 
                className="mt-1 accent-[#EE7F22] w-4 h-4" 
                checked={assignmentOption === "custom"}
                onChange={() => setAssignmentOption("custom")}
              />
              <div>
                <p className={`text-[15px] font-bold ${assignmentOption === "custom" ? "text-[#EE7F22]" : "text-[#212B36]"}`}>
                  Create Custom Role
                </p>
                <p className="text-[13px] text-gray-500 mt-1">Define a new role with specific permissions</p>
              </div>
            </label>
          </div>
        </div>

        {/* Dynamic Content based on selection */}
        {assignmentOption === "existing" ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
            <div className="mb-8">
              <label className="block text-[12px] font-bold text-gray-700 uppercase mb-2">Role</label>
              <div className="relative max-w-md">
                <select 
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="w-full h-[48px] px-4 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] appearance-none cursor-pointer"
                >
                  {SYSTEM_ROLES.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <IconChevron />
                </div>
              </div>
              {selectedRole && (
                <p className="text-[13px] text-gray-500 mt-3 italic">{selectedRole.description}</p>
              )}
            </div>

            {selectedRole && (
              <div className="mt-10">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[16px] font-bold text-[#212B36]">Permission Summary</h3>
                  <span className="text-[13px] text-gray-300 italic font-medium">Read-only</span>
                </div>
                
                <div className="space-y-4">
                  {Object.entries(selectedRole.permissions).map(([category, perms]) => (
                    <div key={category} className="bg-[#F8F9FB] rounded-xl p-6 border border-gray-50">
                      <h4 className="text-[14px] font-bold text-[#637381] mb-5 uppercase tracking-wider">
                        {category}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-12">
                        {perms.map((perm, idx) => (
                          <div key={idx} className="flex items-center gap-3 group">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#EE7F22] flex-shrink-0 group-hover:scale-125 transition-transform"></div>
                            <span className="text-[14px] text-[#212B36] font-medium leading-tight">{perm}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="mb-8">
              <label className="block text-[12px] font-bold text-gray-700 uppercase mb-2">Role Name</label>
              <input 
                type="text"
                placeholder="Enter custom role name"
                value={customRoleName}
                onChange={(e) => setCustomRoleName(e.target.value)}
                className="w-full max-w-md h-[48px] px-4 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] transition-all"
              />
            </div>

            <div className="space-y-4">
              {Object.entries(ALL_PERMISSIONS).map(([category, perms]) => (
                <div key={category} className="bg-[#F8F9FB] rounded-xl p-6 border border-gray-50">
                  <h4 className="text-[14px] font-bold text-[#637381] mb-5 uppercase tracking-wider">
                    {category}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {perms.map((perm) => (
                      <label 
                        key={perm} 
                        className={`flex items-center gap-3 p-3.5 rounded-lg border-2 transition-all cursor-pointer ${
                          selectedPermissions.includes(perm) 
                            ? "bg-white border-[#EE7F22] shadow-sm" 
                            : "bg-white/50 border-transparent hover:border-gray-100"
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 accent-[#EE7F22] rounded cursor-pointer"
                          checked={selectedPermissions.includes(perm)}
                          onChange={() => handleTogglePermission(perm)}
                        />
                        <span className={`text-[14px] font-medium ${
                          selectedPermissions.includes(perm) ? "text-[#212B36]" : "text-gray-500"
                        }`}>
                          {perm}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-10">
          <button 
            type="button"
            onClick={() => router.back()}
            className="px-8 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-[14px] hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSave}
            className="px-8 py-2.5 rounded-xl bg-[#EE7F22] text-white font-bold text-[14px] hover:bg-[#d66f1b] shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Create & Assign Role
          </button>
        </div>
      </div>
    </div>
  );
}
