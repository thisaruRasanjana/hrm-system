"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconArrowLeft } from "@/components/Icons";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import DepartmentSelect from "@/components/DepartmentSelect";
import DesignationSelect from "@/components/DesignationSelect";

function SectionCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-50 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#EE7F22]/10 flex items-center justify-center text-[#EE7F22] flex-shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">{title}</h2>
          {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function FormField({ label, required, children, half }: { label: string; required?: boolean; children: React.ReactNode; half?: boolean }) {
  return (
    <div className={half ? "" : ""}>
      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] focus:bg-white transition-all duration-200";
const selectCls = `${inputCls} appearance-none cursor-pointer`;

export default function EmployeeAddPage() {
  const router = useRouter();
  const { hasPermission, loading: authLoading, user } = useAuth();

  useEffect(() => {
    if (!authLoading && !hasPermission("employee:create")) {
      router.replace("/dashboard/employees");
    }
  }, [authLoading, hasPermission, router]);

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
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    skills: "",
    qualifications: "",
    bankName: "",
    bankAccountNo: "",
    bankBranch: "",
    work: {
      departmentId: null as number | null,
      roleId: null as number | null,
      designationId: null as number | null,
      designationStartDate: "",
      designationEndDate: "",
      joinedDate: "",
      status: "active",
    },
  });

  const [roles, setRoles] = useState<{ id: number; role_name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);

  const [leaveTypes, setLeaveTypes] = useState<{ id: number; name: string; default_days: number | null }[]>([]);
  const [showDesignationOverrides, setShowDesignationOverrides] = useState(false);
  const [customLeaveEntitlements, setCustomLeaveEntitlements] = useState<Record<number, string>>({});
  // Monthly accrual rules: { [leaveTypeId]: { daysPerMonth: string; carryForwardAllowed?: boolean } }
  const [accrualRules, setAccrualRules] = useState<Record<number, { daysPerMonth: string; carryForwardAllowed?: boolean }>>({}); 
  // Whether each leave type is in "accrual" or "flat" mode
  const [leaveModes, setLeaveModes] = useState<Record<number, "flat" | "accrual">>({});

  useEffect(() => {
    if (authLoading || !user) return;
    const init = async () => {
      setFormData(prev => ({
        ...prev,
        employeeId: `EMP-${Math.floor(1000 + Math.random() * 9000)}`
      }));
      try {
        const roleData = await api.get<{ id: number; role_name: string }[]>("/roles/");
        setRoles(roleData);
        setFormData(prev => ({
          ...prev,
          work: { ...prev.work, roleId: roleData.length > 0 ? roleData[0].id : null }
        }));
        const types = await api.get<any>("/leave/types");
        setLeaveTypes(types);
      } catch (err) {
        console.error("Failed to fetch initial data", err);
      }
    };
    init();
  }, [authLoading, user]);

  const handleAutoCalculateProrated = () => {
    const startStr = formData.work.designationStartDate || formData.work.joinedDate;
    if (!startStr) {
      alert("Please select a Start Date or Joined Date first.");
      return;
    }
    const startMonth = new Date(startStr).getMonth();
    const remainingMonths = 12 - startMonth;
    if (remainingMonths <= 0 || remainingMonths > 12) return;

    const newEntitlements = { ...customLeaveEntitlements };
    const newModes = { ...leaveModes };

    leaveTypes.forEach((lt) => {
      newModes[lt.id] = "flat";
      const defaultDays = lt.default_days || 0;
      let calculated = (defaultDays / 12) * remainingMonths;
      // Round to nearest 0.5
      calculated = Math.round(calculated * 2) / 2;
      newEntitlements[lt.id] = String(calculated);
    });

    setLeaveModes(newModes);
    setCustomLeaveEntitlements(newEntitlements);
    setShowDesignationOverrides(true);
  };

  const handleSave = async (redirectToRole: boolean = false) => {
    if (!formData.employeeId || !formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.work.designationId || !formData.work.departmentId || !formData.work.roleId) {
      setError("Please fill in all required fields marked with *.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const leave_entitlements = Object.entries(customLeaveEntitlements)
        .filter(([typeId, value]) => value !== "" && leaveModes[Number(typeId)] !== "accrual")
        .map(([typeId, value]) => ({ leave_type_id: parseInt(typeId), days: parseFloat(value) }));

      if (leave_entitlements.some((e) => Number.isNaN(e.days) || e.days < 0 || e.days > 365)) {
        throw new Error("Pre-assigned leave days must be between 0 and 365.");
      }

      const designation_accrual_rules = Object.entries(accrualRules)
        .filter(([typeId]) => leaveModes[Number(typeId)] === "accrual")
        .map(([typeId, rule]) => {
          // Auto-compute total cap from period dates × days_per_month
          let computedCap: number | null = null;
          if (rule.daysPerMonth && formData.work.designationStartDate && formData.work.designationEndDate) {
            const start = new Date(formData.work.designationStartDate);
            const end = new Date(formData.work.designationEndDate);
            const months = Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
            computedCap = parseFloat(rule.daysPerMonth) * months;
          }
          return ({
            leave_type_id: parseInt(typeId),
            days_per_month: parseFloat(rule.daysPerMonth),
            total_leaves_cap: computedCap,
            carry_forward_allowed: !!rule.carryForwardAllowed
          });
        })
        .filter((r) => !Number.isNaN(r.days_per_month) && r.days_per_month > 0);

      const payload = {
        employee_id: formData.employeeId,
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address || null,
        department_id: formData.work.departmentId,
        role_id: formData.work.roleId,
        designation_id: formData.work.designationId,
        designation_start_date: formData.work.designationStartDate || formData.work.joinedDate || null,
        designation_end_date: formData.work.designationEndDate || null,
        joined_date: formData.work.joinedDate || null,
        status: formData.work.status,
        date_of_birth: formData.dateOfBirth || null,
        gender: formData.gender || null,
        marital_status: formData.maritalStatus || null,
        nationality: formData.nationality || null,
        emergency_contact_name: formData.emergencyContactName || null,
        emergency_contact_phone: formData.emergencyContactPhone || null,
        emergency_contact_relation: formData.emergencyContactRelation || null,
        skills: formData.skills || null,
        qualifications: formData.qualifications || null,
        bank_name: formData.bankName || null,
        bank_account_no: formData.bankAccountNo || null,
        bank_branch: formData.bankBranch || null,
        designation_leave_overrides: leave_entitlements.length > 0 ? leave_entitlements : null,
        designation_accrual_rules: designation_accrual_rules.length > 0 ? designation_accrual_rules : null,
      };

      const created = await api.post<{ id: number }>("/employees/", payload);
      if (redirectToRole && created?.id) {
        router.push(`/dashboard/EmployeeManagement/assign-role?id=${created.id}`);
      } else {
        router.push("/dashboard/employees");
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to add employee.";
      if (msg.toLowerCase().includes("email already used")) setError("This email is already in use.");
      else if (msg.toLowerCase().includes("employee id already used")) setError("This Employee ID is already in use.");
      else if (msg.includes("422")) setError("Please check all required fields.");
      else setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="max-w-[860px] mx-auto pb-20 pt-2">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/employees"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-5 font-medium group"
        >
          <span className="group-hover:-translate-x-0.5 transition-transform">
            <IconArrowLeft />
          </span>
          Back to Employees
        </Link>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#EE7F22]/100 flex items-center justify-center flex-shrink-0 shadow-md shadow-orange-200">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add New Employee</h1>
            <p className="text-sm text-gray-500 mt-1">Fill in the details below to register a new team member</p>
          </div>
        </div>
      </div>

      {/* Progress steps hint */}
      <div className="flex items-center gap-2 mb-6 text-xs text-gray-400 font-medium">
        <span className="bg-[#EE7F22]/100 text-white px-2.5 py-0.5 rounded-full">1</span>
        <span className="text-gray-600 font-semibold">Basic Details</span>
        <span className="text-gray-300">→</span>
        <span className="bg-gray-100 text-gray-400 px-2.5 py-0.5 rounded-full">2</span>
        Work Info
        <span className="text-gray-300">→</span>
        <span className="bg-gray-100 text-gray-400 px-2.5 py-0.5 rounded-full">3</span>
        Leave & More
      </div>

      <div className="space-y-5">
        {/* Basic Information */}
        <SectionCard
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
          title="Basic Information"
          description="Personal contact details for the employee"
        >
          <div className="space-y-5">
            <FormField label="Employee ID" required>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="EMP-0001"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, employeeId: `EMP-${Math.floor(1000 + Math.random() * 9000)}` }))}
                  className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-colors whitespace-nowrap"
                  title="Regenerate ID"
                >
                  ↻ Regenerate
                </button>
              </div>
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="First Name" required>
                <input type="text" placeholder="Enter first name" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className={inputCls} />
              </FormField>
              <FormField label="Last Name" required>
                <input type="text" placeholder="Enter last name" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className={inputCls} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Email Address" required>
                <input type="email" placeholder="name@company.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputCls} />
              </FormField>
              <FormField label="Phone Number" required>
                <input type="tel" placeholder="+94 77 000 0000" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={inputCls} />
              </FormField>
            </div>

            <FormField label="Address">
              <input type="text" placeholder="Enter full address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={inputCls} />
            </FormField>
          </div>
        </SectionCard>

        {/* Work Information */}
        <SectionCard
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>}
          title="Work Information"
          description="Department, role, and employment details"
        >
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Department" required>
                <DepartmentSelect
                  value={formData.work.departmentId}
                  onChange={(id) => setFormData({ ...formData, work: { ...formData.work, departmentId: id } })}
                  selectClass={selectCls}
                />
              </FormField>
              <FormField label="Initial Role" required>
                <select
                  value={formData.work.roleId || ""}
                  onChange={(e) => setFormData({ ...formData, work: { ...formData.work, roleId: parseInt(e.target.value) } })}
                  className={selectCls}
                >
                  <option value="" disabled>Select Role</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.role_name}</option>)}
                </select>
              </FormField>
            </div>

            <FormField label="Designation" required>
              <DesignationSelect
                value={formData.work.designationId}
                onChange={(id) => setFormData({ ...formData, work: { ...formData.work, designationId: id } })}
                selectClass={selectCls}
              />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Joined Date">
                <input
                  type="date"
                  value={formData.work.joinedDate}
                  onChange={(e) => setFormData({ ...formData, work: { ...formData.work, joinedDate: e.target.value } })}
                  className={`${inputCls} [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50`}
                />
              </FormField>
              <FormField label="Employment Status">
                <div className="flex bg-gray-100 p-1 rounded-xl w-fit mt-0.5">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, work: { ...formData.work, status: "active" } })}
                    className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${formData.work.status === "active" ? "bg-white text-[#EE7F22] shadow-sm border border-[#EE7F22]/20" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${formData.work.status === "active" ? "bg-[#EE7F22]" : "bg-gray-300"}`} />
                      <span className="leading-none pt-[1px]">Active</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, work: { ...formData.work, status: "inactive" } })}
                    className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${formData.work.status === "inactive" ? "bg-white text-gray-700 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    Inactive
                  </button>
                </div>
              </FormField>
            </div>
          </div>
        </SectionCard>

        {/* Designation Period & Leave Overrides */}
        {!showDesignationOverrides ? (
          <button
            type="button"
            onClick={() => setShowDesignationOverrides(true)}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-[13px] font-medium text-gray-400 hover:border-[#EE7F22]/30 hover:text-[#EE7F22] hover:bg-[#EE7F22]/5 transition-all duration-200 flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Set Designation Period & Leave Overrides
          </button>
        ) : (
          <SectionCard
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
            title="Designation Period & Leave Overrides"
            description="Optional. If no period is set, the system assumes an open-ended designation with default leave rules."
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField label="Start Date">
                  <input type="date" value={formData.work.designationStartDate || formData.work.joinedDate} onChange={(e) => setFormData({ ...formData, work: { ...formData.work, designationStartDate: e.target.value } })} className={inputCls} />
                </FormField>
                <FormField label="End Date">
                  <input type="date" value={formData.work.designationEndDate} onChange={(e) => setFormData({ ...formData, work: { ...formData.work, designationEndDate: e.target.value } })} className={inputCls} />
                  <p className="text-[11px] text-gray-400 mt-1">Leave blank if open-ended</p>
                </FormField>
              </div>

              {/* Duration Stepper */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Duration</span>
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                  <button
                    type="button"
                    disabled={!formData.work.designationStartDate && !formData.work.joinedDate}
                    onClick={() => {
                      const startStr = formData.work.designationStartDate || formData.work.joinedDate;
                      const start = new Date(startStr);
                      const end = formData.work.designationEndDate ? new Date(formData.work.designationEndDate) : new Date(start);
                      const diff = Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
                      const newEnd = new Date(start);
                      newEnd.setMonth(newEnd.getMonth() + Math.max(1, diff - 1));
                      setFormData({ ...formData, work: { ...formData.work, designationEndDate: newEnd.toISOString().split('T')[0] } });
                    }}
                    className="px-3 py-2 text-gray-500 hover:text-[#EE7F22] hover:bg-orange-50 transition-colors font-bold text-base disabled:opacity-30 disabled:cursor-not-allowed border-r border-gray-200"
                  >−</button>
                  <input
                    type="number" min="1" max="120"
                    disabled={!formData.work.designationStartDate && !formData.work.joinedDate}
                    value={(() => {
                      const startStr = formData.work.designationStartDate || formData.work.joinedDate;
                      if (!startStr || !formData.work.designationEndDate) return "";
                      const diff = (new Date(formData.work.designationEndDate).getFullYear() - new Date(startStr).getFullYear()) * 12 + (new Date(formData.work.designationEndDate).getMonth() - new Date(startStr).getMonth());
                      return diff > 0 ? String(diff) : "";
                    })()}
                    onChange={(e) => {
                      const months = parseInt(e.target.value);
                      if (!months || months < 1) return;
                      const start = new Date(formData.work.designationStartDate || formData.work.joinedDate);
                      const newEnd = new Date(start);
                      newEnd.setMonth(newEnd.getMonth() + months);
                      setFormData({ ...formData, work: { ...formData.work, designationEndDate: newEnd.toISOString().split('T')[0] } });
                    }}
                    placeholder="—"
                    className="w-12 text-center bg-transparent text-[14px] font-semibold text-gray-800 outline-none py-2 disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    disabled={!formData.work.designationStartDate && !formData.work.joinedDate}
                    onClick={() => {
                      const startStr = formData.work.designationStartDate || formData.work.joinedDate;
                      const start = new Date(startStr);
                      const end = formData.work.designationEndDate ? new Date(formData.work.designationEndDate) : new Date(start);
                      const diff = Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
                      const newEnd = new Date(start);
                      newEnd.setMonth(newEnd.getMonth() + diff + 1);
                      setFormData({ ...formData, work: { ...formData.work, designationEndDate: newEnd.toISOString().split('T')[0] } });
                    }}
                    className="px-3 py-2 text-gray-500 hover:text-[#EE7F22] hover:bg-orange-50 transition-colors font-bold text-base disabled:opacity-30 disabled:cursor-not-allowed border-l border-gray-200"
                  >+</button>
                </div>
                <span className="text-[13px] text-gray-400">months</span>
              </div>
              {/* Leave Overrides Grid */}
              <div>
                <div className="flex items-center justify-between mt-2 mb-3">
                  <div>
                    <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wider mb-1">Leave Overrides for this period</h3>
                    <p className="text-[11px] text-gray-400">Set a fixed total for each leave type. Leave blank to use the system default.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoCalculateProrated}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EE7F22]/10 text-[#EE7F22] text-xs font-semibold rounded-lg hover:bg-[#EE7F22]/20 transition-colors shadow-sm whitespace-nowrap"
                  >
                    ✨ Auto-Calculate Prorated
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {leaveTypes.map((type) => {
                    const mode = leaveModes[type.id] || "flat";
                    const isActive = mode === "flat" && !!customLeaveEntitlements[type.id];
                    return (
                      <div key={type.id} className={`border rounded-xl p-4 transition-all ${isActive ? "border-[#EE7F22]/40 bg-orange-50/40" : "border-gray-100 bg-gray-50/50"}`}>
                        <span className="block text-[12px] font-bold text-gray-700 uppercase tracking-wider truncate">{type.name}</span>
                        <div className="text-[11px] text-gray-400 mt-1 mb-3">
                          Default: <span className="font-semibold text-gray-600">{type.default_days != null ? `${type.default_days} days` : "Unlimited"}</span>
                        </div>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="Custom limit..."
                          value={mode === "accrual" ? "" : (customLeaveEntitlements[type.id] || "")}
                          disabled={mode === "accrual"}
                          onChange={(e) => setCustomLeaveEntitlements({ ...customLeaveEntitlements, [type.id]: e.target.value })}
                          className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[13px] text-gray-900 outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] transition-colors ${mode === "accrual" ? "opacity-40 cursor-not-allowed" : ""}`}
                        />
                        {mode === "accrual" && (
                          <p className="text-[10px] text-orange-500 mt-1.5 font-medium">Managed by monthly accrual below ↓</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>


              {/* Monthly Accrual Section — one card per leave type */}
              <div>
                <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wider mb-1">Monthly Accrual Rules</h3>
                <p className="text-[11px] text-gray-400 mb-3">Enable monthly accrual for any leave type. This overrides the flat limit above.</p>
                <div className="space-y-3">
                  {leaveTypes.map((leaveType) => {
                    const isAccrual = leaveModes[leaveType.id] === "accrual";
                    return (
                      <div key={leaveType.id} className={`rounded-2xl border-2 transition-all duration-300 ${isAccrual ? "border-[#EE7F22]/30 bg-gradient-to-br from-orange-50/60 to-amber-50/40" : "border-dashed border-gray-200 bg-gray-50/40"}`}>
                        <div className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isAccrual ? "bg-[#EE7F22] shadow-md shadow-orange-200" : "bg-gray-200"}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isAccrual ? "white" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-[13px] font-bold text-gray-700">Monthly {leaveType.name} Accrual</p>
                                <p className="text-[11px] text-gray-400">Accrue {leaveType.name.toLowerCase()} leave each month.</p>
                              </div>
                            </div>
                            {/* Toggle switch */}
                            <button
                              type="button"
                              onClick={() => setLeaveModes({ ...leaveModes, [leaveType.id]: isAccrual ? "flat" : "accrual" })}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${isAccrual ? "bg-[#EE7F22]" : "bg-gray-200"}`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${isAccrual ? "translate-x-6" : "translate-x-1"}`} />
                            </button>
                          </div>

                          {isAccrual && (
                            <div className="mt-4 pt-4 border-t border-orange-100 space-y-3">
                              {/* Days Per Month input */}
                              <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Days Per Month</label>
                                <div className="flex items-center gap-3">
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0.5"
                                    placeholder="e.g. 1"
                                    value={accrualRules[leaveType.id]?.daysPerMonth || ""}
                                    onChange={(e) => setAccrualRules({ ...accrualRules, [leaveType.id]: { ...accrualRules[leaveType.id], daysPerMonth: e.target.value } })}
                                    className="w-32 px-3 py-2 bg-white border border-orange-200 rounded-lg text-[13px] text-gray-900 outline-none focus:ring-2 focus:ring-[#EE7F22]/30 focus:border-[#EE7F22] transition-colors"
                                  />
                                  <span className="text-[12px] text-gray-500 font-medium">days / month</span>
                                </div>
                              </div>

                              {/* Auto-computed total — only shows when both days and period are set */}
                              {accrualRules[leaveType.id]?.daysPerMonth && formData.work.designationStartDate && formData.work.designationEndDate && (() => {
                                const start = new Date(formData.work.designationStartDate);
                                const end = new Date(formData.work.designationEndDate);
                                const months = Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
                                const total = (parseFloat(accrualRules[leaveType.id].daysPerMonth) * months).toFixed(1);
                                return (
                                  <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                                    <div>
                                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total for Period</p>
                                      <p className="text-xl font-bold text-[#EE7F22] leading-tight">{total} <span className="text-sm font-normal text-gray-500">days</span></p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Duration</p>
                                      <p className="text-sm font-semibold text-gray-700">{months} months</p>
                                      <p className="text-[10px] text-gray-400">{accrualRules[leaveType.id].daysPerMonth} × {months}</p>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* No period set — hint */}
                              {accrualRules[leaveType.id]?.daysPerMonth && (!formData.work.designationStartDate || !formData.work.designationEndDate) && (
                                <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                  Set a designation start & end date above to auto-calculate the total leaves.
                                </p>
                              )}

                              {/* Carry forward toggle */}
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`carryForward-${leaveType.id}`}
                                  checked={accrualRules[leaveType.id]?.carryForwardAllowed || false}
                                  onChange={(e) => setAccrualRules({ ...accrualRules, [leaveType.id]: { ...accrualRules[leaveType.id], carryForwardAllowed: e.target.checked } })}
                                  className="w-4 h-4 text-[#EE7F22] rounded border-gray-300 focus:ring-[#EE7F22]"
                                />
                                <label htmlFor={`carryForward-${leaveType.id}`} className="text-[13px] text-gray-700 font-medium cursor-pointer select-none">
                                  Allow carry forward of unused leaves
                                </label>
                              </div>
                              <p className="text-[11px] text-gray-400">If carry forward is off, unused days from previous months are lost.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>


              <div className="flex justify-end">
                <button type="button" onClick={() => setShowDesignationOverrides(false)} className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Additional Information Toggle */}
        {!showAdditionalInfo && (
          <button
            type="button"
            onClick={() => setShowAdditionalInfo(true)}
            className="w-full py-3.5 border-2 border-dashed border-gray-200 rounded-2xl text-sm font-medium text-gray-400 hover:border-orange-300 hover:text-[#EE7F22] transition-all duration-200 flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add Additional Information (Optional)
          </button>
        )}

        {showAdditionalInfo && (
          <>
            {/* Personal Information */}
            <SectionCard
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>}
              title="Personal Information"
              description="Optional demographic and personal details"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField label="Date of Birth">
                  <input type="date" value={formData.dateOfBirth} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })} className={`${inputCls} [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50`} />
                </FormField>
                <FormField label="Gender">
                  <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} className={selectCls}>
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </FormField>
                <FormField label="Marital Status">
                  <select value={formData.maritalStatus} onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })} className={selectCls}>
                    <option value="">Select status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </FormField>
                <FormField label="Nationality">
                  <input type="text" placeholder="e.g., Sri Lankan" value={formData.nationality} onChange={(e) => setFormData({ ...formData, nationality: e.target.value })} className={inputCls} />
                </FormField>
              </div>
            </SectionCard>

            {/* Emergency Contact */}
            <SectionCard
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.36 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>}
              title="Emergency Contact"
              description="Person to contact in case of emergency"
            >
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField label="Contact Name">
                    <input type="text" placeholder="Enter contact name" value={formData.emergencyContactName} onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })} className={inputCls} />
                  </FormField>
                  <FormField label="Relationship">
                    <input type="text" placeholder="e.g., Spouse, Parent" value={formData.emergencyContactRelation} onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })} className={inputCls} />
                  </FormField>
                </div>
                <FormField label="Phone Number">
                  <input type="tel" placeholder="+94 77 000 0000" value={formData.emergencyContactPhone} onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })} className={inputCls} />
                </FormField>
              </div>
            </SectionCard>

            {/* Skills & Qualifications */}
            <SectionCard
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
              title="Skills & Qualifications"
              description="Technical skills and educational background"
            >
              <div className="space-y-5">
                <FormField label="Skills">
                  <textarea
                    placeholder="List skills separated by commas (e.g., JavaScript, React, SQL)"
                    value={formData.skills}
                    onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                    className={`${inputCls} min-h-[90px] py-3 resize-none`}
                  />
                </FormField>
                <FormField label="Qualifications">
                  <textarea
                    placeholder="Enter educational qualifications and certifications"
                    value={formData.qualifications}
                    onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                    className={`${inputCls} min-h-[90px] py-3 resize-none`}
                  />
                </FormField>
              </div>
            </SectionCard>

            {/* Bank Details */}
            <SectionCard
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>}
              title="Bank Details"
              description="For payroll and salary processing"
            >
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField label="Bank Name">
                    <input type="text" placeholder="Enter bank name" value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} className={inputCls} />
                  </FormField>
                  <FormField label="Account Number">
                    <input type="text" placeholder="Enter account number" value={formData.bankAccountNo} onChange={(e) => setFormData({ ...formData, bankAccountNo: e.target.value })} className={inputCls} />
                  </FormField>
                </div>
                <FormField label="Branch Name">
                  <input type="text" placeholder="Enter branch name" value={formData.bankBranch} onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })} className={inputCls} />
                </FormField>
              </div>
            </SectionCard>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-3">
            <svg className="mt-0.5 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-2">
          <Link
            href="/dashboard/employees"
            className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            Cancel
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Saving…" : "Save Only"}
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#EE7F22]/100 text-white font-semibold text-sm hover:bg-orange-600 shadow-sm hover:shadow-md shadow-orange-200 transition-all duration-200 disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              {isSubmitting ? "Saving…" : "Save & Assign Role"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
