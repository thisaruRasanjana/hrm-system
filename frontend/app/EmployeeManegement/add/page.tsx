"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconArrowLeft } from "../../components/icons";

export default function EmployeeAddPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    work: {
      department: "Human Resources",
      designation: "",
      joinedDate: "",
      status: "active",
    },
  });

  // Shared input styling
  const inputClass = "w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] transition-colors duration-200 mt-1.5";
  const labelClass = "block text-[12px] font-bold text-gray-700 uppercase";
  const requiredAsterisk = <span className="text-[#EF4444] ml-1">*</span>;

  const handleSave = () => {
    console.log("Adding employee data:", formData);
    router.push("/");
  };

  return (
    <div className="max-w-[1000px] mx-auto pb-20 pt-2">
      {/* Header / Back Navigation */}
      <div className="mb-8">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-[14px] text-gray-500 hover:text-gray-800 transition-colors mb-4 font-medium"
        >
          <IconArrowLeft />
          Back
        </Link>
        <h1 className="text-[28px] font-bold text-[#212B36]">Add New Employee</h1>
        <p className="text-[14px] text-gray-400 mt-1">Enter employee details to register</p>
      </div>

      <div className="space-y-6">
        {/* Basic Information Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-[16px] font-bold text-[#212B36] mb-6">Basic Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>
                FIRST NAME {requiredAsterisk}
              </label>
              <input 
                type="text" 
                placeholder="Enter first name"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                className={inputClass} 
              />
            </div>
            <div>
              <label className={labelClass}>
                LAST NAME {requiredAsterisk}
              </label>
              <input 
                type="text" 
                placeholder="Enter last name"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                className={inputClass} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>
                EMAIL {requiredAsterisk}
              </label>
              <input 
                type="email" 
                placeholder="example@company.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className={inputClass} 
              />
            </div>
            <div>
              <label className={labelClass}>
                PHONE {requiredAsterisk}
              </label>
              <input 
                type="tel" 
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className={inputClass} 
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>ADDRESS</label>
            <input 
              type="text"
              placeholder="Enter full address"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className={inputClass}
            />
          </div>
        </div>

        {/* Work Information Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-[16px] font-bold text-[#212B36] mb-6">Work Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>
                DEPARTMENT {requiredAsterisk}
              </label>
              <select 
                value={formData.work.department}
                onChange={(e) => setFormData({...formData, work: {...formData.work, department: e.target.value}})}
                className={`${inputClass} appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E')] bg-[length:20px_20px] bg-[right_12px_center] bg-no-repeat`}
              >
                <option value="Human Resources">Human Resources</option>
                <option value="Engineering">Engineering</option>
                <option value="Design">Design</option>
                <option value="Marketing">Marketing</option>
                <option value="Sales">Sales</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                DESIGNATION {requiredAsterisk}
              </label>
              <input 
                type="text" 
                placeholder="e.g., Senior Software Engineer"
                value={formData.work.designation}
                onChange={(e) => setFormData({...formData, work: {...formData.work, designation: e.target.value}})}
                className={inputClass} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>JOINED DATE</label>
              <div className="relative">
                <input 
                  type="date" 
                  value={formData.work.joinedDate}
                  onChange={(e) => setFormData({...formData, work: {...formData.work, joinedDate: e.target.value}})}
                  className={`${inputClass} [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60`} 
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>EMPLOYMENT STATUS</label>
              <div className="flex bg-gray-100 p-1.5 rounded-lg w-fit mt-1.5">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, work: {...formData.work, status: "active"}})}
                  className={`px-8 py-2 rounded-md text-[14px] font-medium transition-all duration-200 ${
                    formData.work.status === "active" 
                      ? "bg-[#EE7F22] text-white shadow-sm" 
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, work: {...formData.work, status: "inactive"}})}
                  className={`px-8 py-2 rounded-md text-[14px] font-medium transition-all duration-200 ${
                    formData.work.status === "inactive" 
                      ? "bg-white text-gray-800 shadow-sm" 
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                  }`}
                >
                  Inactive
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-8">
          <button 
            type="button"
            className="px-6 py-2.5 rounded-xl bg-[#F8F9FA] text-[#212B36] font-medium text-[14px] hover:bg-gray-100 transition-colors"
          >
            Save
          </button>
          <Link 
            href="/EmployeeManegement/assign-role"
            className="px-6 py-2.5 rounded-xl bg-[#EE7F22] text-white font-medium text-[14px] hover:bg-[#d66f1b] shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Assign New Permissions & Save
          </Link>
        </div>
      </div>
    </div>
  );
}
