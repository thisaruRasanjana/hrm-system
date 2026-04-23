"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconArrowLeft } from "@/components/icons";
import { api } from "@/lib/api";

interface Department {
  id: number;
  name: string;
}

export default function EmployeeAddPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    employeeId: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    dateOfBirth: "",
    gender: "",
    maritalStatus: "",
    nationality: "",
    // Emergency Contact
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    // Skills & Qualifications
    skills: "",
    qualifications: "",
    // Bank Details
    bankName: "",
    bankAccountNo: "",
    bankBranch: "",
    work: {
      departmentId: null as number | null,
      roleId: null as number | null,
      designation: "",
      joinedDate: "",
      status: "active",
    },
  });

  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<{ id: number; role_name: string }[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with a random ID
  useEffect(() => {
    const init = async () => {
      setFormData(prev => ({
        ...prev,
        employeeId: `EMP-${Math.floor(1000 + Math.random() * 9000)}`
      }));

      try {
        const [deps, roleData] = await Promise.all([
          api.get<Department[]>("/departments/"),
          api.get<{ id: number; role_name: string }[]>("/roles/")
        ]);

        setDepartments(deps);
        setRoles(roleData);

        setFormData(prev => ({
          ...prev,
          work: {
            ...prev.work,
            departmentId: deps.length > 0 ? deps[0].id : null,
            roleId: roleData.length > 0 ? roleData[0].id : null
          }
        }));
      } catch (err) {
        console.error("Failed to fetch initial data", err);
      }
    };
    init();
  }, []);

  const inputClass = "w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] transition-colors duration-200 mt-1.5";
  const labelClass = "block text-[12px] font-bold text-gray-700 uppercase";
  const requiredAsterisk = <span className="text-[#EF4444] ml-1">*</span>;
  const selectClass = `${inputClass} appearance-none cursor-pointer`;

  const handleSave = async (redirectToRole: boolean = false) => {
    if (!formData.employeeId || !formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.work.designation || !formData.work.departmentId || !formData.work.roleId) {
      setError("Please fill in all required fields (marked with *), including Department and Role.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        employee_id: formData.employeeId,
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address || null,
        department_id: formData.work.departmentId,
        role_id: formData.work.roleId,
        designation: formData.work.designation,
        joined_date: formData.work.joinedDate || null,
        status: formData.work.status,
        date_of_birth: formData.dateOfBirth || null,
        gender: formData.gender || null,
        marital_status: formData.maritalStatus || null,
        nationality: formData.nationality || null,
        // New Fields
        emergency_contact_name: formData.emergencyContactName || null,
        emergency_contact_phone: formData.emergencyContactPhone || null,
        emergency_contact_relation: formData.emergencyContactRelation || null,
        skills: formData.skills || null,
        qualifications: formData.qualifications || null,
        bank_name: formData.bankName || null,
        bank_account_no: formData.bankAccountNo || null,
        bank_branch: formData.bankBranch || null,
      };

      const created = await api.post<{ id: number }>("/employees/", payload);

      if (redirectToRole && created?.id) {
        router.push(`/EmployeeManegement/assign-role?id=${created.id}`);
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add employee.";
      setError(msg.includes("422") ? "Please check your data — a required field may be invalid or the Employee ID/Email is already used." : msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto pb-20 pt-2">
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center gap-2 text-[14px] text-gray-500 hover:text-gray-800 transition-colors mb-4 font-medium">
          <IconArrowLeft />
          Back
        </Link>
        <h1 className="text-[28px] font-bold text-[#212B36]">Add New Employee</h1>
        <p className="text-[14px] text-gray-400 mt-1">Enter employee details to register</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-[14px]">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-[16px] font-bold text-[#212B36] mb-6">Basic Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>EMPLOYEE ID {requiredAsterisk}</label>
              <input
                type="text"
                placeholder="EMP-0001"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="hidden md:block"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>FIRST NAME {requiredAsterisk}</label>
              <input type="text" placeholder="Enter first name" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>LAST NAME {requiredAsterisk}</label>
              <input type="text" placeholder="Enter last name" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>EMAIL {requiredAsterisk}</label>
              <input type="email" placeholder="example@company.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>PHONE {requiredAsterisk}</label>
              <input type="tel" placeholder="+94 77 000 0000" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>ADDRESS</label>
            <input type="text" placeholder="Enter full address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={inputClass} />
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-[16px] font-bold text-[#212B36] mb-6">Personal Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>DATE OF BIRTH</label>
              <input type="date" value={formData.dateOfBirth} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })} className={`${inputClass} [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60`} />
            </div>
            <div>
              <label className={labelClass}>GENDER</label>
              <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} className={selectClass}>
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>MARITAL STATUS</label>
              <select value={formData.maritalStatus} onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })} className={selectClass}>
                <option value="">Select status</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>NATIONALITY</label>
              <input type="text" placeholder="e.g., Sri Lankan" value={formData.nationality} onChange={(e) => setFormData({ ...formData, nationality: e.target.value })} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-[16px] font-bold text-[#212B36] mb-6">Emergency Contact</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>CONTACT NAME</label>
              <input type="text" placeholder="Enter contact name" value={formData.emergencyContactName} onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>RELATIONSHIP</label>
              <input type="text" placeholder="e.g., Spouse, Parent" value={formData.emergencyContactRelation} onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>PHONE NUMBER</label>
            <input type="tel" placeholder="+94 77 000 0000" value={formData.emergencyContactPhone} onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })} className={inputClass} />
          </div>
        </div>

        {/* Skills & Qualifications */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-[16px] font-bold text-[#212B36] mb-6">Skills & Qualifications</h2>
          <div className="space-y-6">
            <div>
              <label className={labelClass}>SKILLS</label>
              <textarea
                placeholder="List skills separated by commas (e.g., JavaScript, React, SQL)"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                className={`${inputClass} min-h-[100px] py-3 resize-none`}
              />
            </div>
            <div>
              <label className={labelClass}>QUALIFICATIONS</label>
              <textarea
                placeholder="Enter educational qualifications and certifications"
                value={formData.qualifications}
                onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                className={`${inputClass} min-h-[100px] py-3 resize-none`}
              />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-[16px] font-bold text-[#212B36] mb-6">Bank Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>BANK NAME</label>
              <input type="text" placeholder="Enter bank name" value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>ACCOUNT NUMBER</label>
              <input type="text" placeholder="Enter account number" value={formData.bankAccountNo} onChange={(e) => setFormData({ ...formData, bankAccountNo: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>BRANCH NAME</label>
            <input type="text" placeholder="Enter branch name" value={formData.bankBranch} onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })} className={inputClass} />
          </div>
        </div>

        {/* Work Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-[16px] font-bold text-[#212B36] mb-6">Work Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>DEPARTMENT {requiredAsterisk}</label>
              <select value={formData.work.departmentId || ""} onChange={(e) => setFormData({ ...formData, work: { ...formData.work, departmentId: parseInt(e.target.value) } })} className={selectClass}>
                <option value="" disabled>Select Department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>INITIAL ROLE {requiredAsterisk}</label>
              <select value={formData.work.roleId || ""} onChange={(e) => setFormData({ ...formData, work: { ...formData.work, roleId: parseInt(e.target.value) } })} className={selectClass}>
                <option value="" disabled>Select Role</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.role_name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className={labelClass}>DESIGNATION {requiredAsterisk}</label>
              <input type="text" placeholder="e.g., Senior Software Engineer" value={formData.work.designation} onChange={(e) => setFormData({ ...formData, work: { ...formData.work, designation: e.target.value } })} className={inputClass} />
            </div>
            <div className="hidden md:block"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>JOINED DATE</label>
              <input type="date" value={formData.work.joinedDate} onChange={(e) => setFormData({ ...formData, work: { ...formData.work, joinedDate: e.target.value } })} className={`${inputClass} [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60`} />
            </div>
            <div>
              <label className={labelClass}>EMPLOYMENT STATUS</label>
              <div className="flex bg-gray-100 p-1.5 rounded-lg w-fit mt-1.5">
                <button type="button" onClick={() => setFormData({ ...formData, work: { ...formData.work, status: "active" } })} className={`px-8 py-2 rounded-md text-[14px] font-medium transition-all duration-200 ${formData.work.status === "active" ? "bg-[#EE7F22] text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}>Active</button>
                <button type="button" onClick={() => setFormData({ ...formData, work: { ...formData.work, status: "inactive" } })} className={`px-8 py-2 rounded-md text-[14px] font-medium transition-all duration-200 ${formData.work.status === "inactive" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}>Inactive</button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-8">
          <button type="button" onClick={() => handleSave(false)} disabled={isSubmitting} className="px-6 py-2.5 rounded-xl bg-[#F8F9FA] text-[#212B36] font-medium text-[14px] hover:bg-gray-100 transition-colors disabled:opacity-50">
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
