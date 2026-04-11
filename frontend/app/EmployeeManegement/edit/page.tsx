"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconArrowLeft } from "@/components/icons";
import { api } from "@/lib/api";

const DEPARTMENTS = ["Human Resources", "Engineering", "Design", "Marketing", "Sales", "Finance", "Operations"];

interface Employee {
  id: number; employee_id: string; first_name: string; last_name: string;
  email: string; phone: string; address: string; department: string;
  designation: string; joined_date: string; status: string;
  date_of_birth?: string; gender?: string; marital_status?: string; nationality?: string;
}

export default function EmployeeEditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", phone: "", address: "",
    dateOfBirth: "", gender: "", maritalStatus: "", nationality: "",
    work: { department: "Human Resources", designation: "", joinedDate: "", status: "active" },
  });

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchEmployee = async () => {
      try {
        const data = await api.get<Employee>(`/employees/${id}`);
        setFormData({
          firstName: data.first_name, lastName: data.last_name,
          email: data.email, phone: data.phone, address: data.address || "",
          dateOfBirth: data.date_of_birth || "", gender: data.gender || "",
          maritalStatus: data.marital_status || "", nationality: data.nationality || "",
          work: { department: data.department, designation: data.designation, joinedDate: data.joined_date || "", status: data.status },
        });
      } catch (error) {
        console.error("Failed to fetch employee:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [id]);

  const inputClass = "w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] transition-colors duration-200 mt-1.5";
  const labelClass = "block text-[12px] font-bold text-gray-700 uppercase";
  const requiredAsterisk = <span className="text-[#EF4444] ml-1">*</span>;
  const selectClass = `${inputClass} appearance-none cursor-pointer`;

  const handleSave = async (redirectToRole: boolean = false) => {
    if (!id) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        first_name: formData.firstName, last_name: formData.lastName,
        email: formData.email, phone: formData.phone,
        address: formData.address || null, department: formData.work.department,
        designation: formData.work.designation, joined_date: formData.work.joinedDate || null,
        status: formData.work.status,
        date_of_birth: formData.dateOfBirth || null, gender: formData.gender || null,
        marital_status: formData.maritalStatus || null, nationality: formData.nationality || null,
      };
      await api.put(`/employees/${id}`, payload);
      if (redirectToRole) {
        router.push(`/EmployeeManegement/assign-role?id=${id}`);
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update employee.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Loading employee details...</div>;

  return (
    <div className="max-w-[1000px] mx-auto pb-20 pt-2">
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center gap-2 text-[14px] text-gray-500 hover:text-gray-800 transition-colors mb-4 font-medium">
          <IconArrowLeft /> Back
        </Link>
        <h1 className="text-[28px] font-bold text-[#212B36]">Edit Employee</h1>
        <p className="text-[14px] text-gray-400 mt-1">Update employee details</p>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-[14px]">{error}</div>}

      <div className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-[16px] font-bold text-[#212B36] mb-6">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>FIRST NAME {requiredAsterisk}</label>
              <input type="text" placeholder="Enter first name" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>LAST NAME {requiredAsterisk}</label>
              <input type="text" placeholder="Enter last name" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>EMAIL {requiredAsterisk}</label>
              <input type="email" placeholder="example@company.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>PHONE {requiredAsterisk}</label>
              <input type="tel" placeholder="+94 77 000 0000" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>ADDRESS</label>
            <input type="text" placeholder="Enter full address" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className={inputClass} />
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-[16px] font-bold text-[#212B36] mb-6">Personal Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>DATE OF BIRTH</label>
              <input type="date" value={formData.dateOfBirth} onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})} className={`${inputClass} [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60`} />
            </div>
            <div>
              <label className={labelClass}>GENDER</label>
              <select value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})} className={selectClass}>
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>MARITAL STATUS</label>
              <select value={formData.maritalStatus} onChange={(e) => setFormData({...formData, maritalStatus: e.target.value})} className={selectClass}>
                <option value="">Select status</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>NATIONALITY</label>
              <input type="text" placeholder="e.g., Sri Lankan" value={formData.nationality} onChange={(e) => setFormData({...formData, nationality: e.target.value})} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Work Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-[16px] font-bold text-[#212B36] mb-6">Work Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>DEPARTMENT {requiredAsterisk}</label>
              <select value={formData.work.department} onChange={(e) => setFormData({...formData, work: {...formData.work, department: e.target.value}})} className={selectClass}>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>DESIGNATION {requiredAsterisk}</label>
              <input type="text" placeholder="e.g., Senior Software Engineer" value={formData.work.designation} onChange={(e) => setFormData({...formData, work: {...formData.work, designation: e.target.value}})} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>JOINED DATE</label>
              <input type="date" value={formData.work.joinedDate} onChange={(e) => setFormData({...formData, work: {...formData.work, joinedDate: e.target.value}})} className={`${inputClass} [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60`} />
            </div>
            <div>
              <label className={labelClass}>EMPLOYMENT STATUS</label>
              <div className="flex bg-gray-100 p-1.5 rounded-lg w-fit mt-1.5">
                <button type="button" onClick={() => setFormData({...formData, work: {...formData.work, status: "active"}})} className={`px-8 py-2 rounded-md text-[14px] font-medium transition-all duration-200 ${formData.work.status === "active" ? "bg-[#EE7F22] text-white shadow-sm" : "text-gray-500 hover:bg-gray-200/50"}`}>Active</button>
                <button type="button" onClick={() => setFormData({...formData, work: {...formData.work, status: "inactive"}})} className={`px-8 py-2 rounded-md text-[14px] font-medium transition-all duration-200 ${formData.work.status === "inactive" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:bg-gray-200/50"}`}>Inactive</button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 mt-8">
          <button type="button" onClick={() => handleSave(false)} disabled={isSubmitting} className="px-6 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium text-[14px] hover:bg-gray-200 transition-colors disabled:opacity-50">
            {isSubmitting ? "Saving..." : "Save"}
          </button>
          <button type="button" onClick={() => handleSave(true)} disabled={isSubmitting} className="px-6 py-2.5 rounded-xl bg-[#EE7F22] text-white font-medium text-[14px] hover:bg-[#d66f1b] shadow-sm hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            {isSubmitting ? "Saving..." : "Save & Assign Role"}
          </button>
        </div>
      </div>
    </div>
  );
}
