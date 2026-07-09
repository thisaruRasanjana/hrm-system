"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconArrowLeft } from "@/components/Icons";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import DepartmentSelect from "@/components/DepartmentSelect";
import DesignationSelect from "@/components/DesignationSelect";
import PromotionLetterModal from "@/components/PromotionLetterModal";

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

function EmployeeEditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
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
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);

  const [leaveTypes, setLeaveTypes] = useState<{ id: number; name: string; default_days: number | null }[]>([]);
  const [showDesignationOverrides, setShowDesignationOverrides] = useState(false);
  const [customLeaveEntitlements, setCustomLeaveEntitlements] = useState<Record<number, string>>({});

  // Promotion letter state
  const [initialDesignationId, setInitialDesignationId] = useState<number | null>(null);
  const [initialPromotionLetterSent, setInitialPromotionLetterSent] = useState(false);
  const [designationNames, setDesignationNames] = useState<Record<number, string>>({});
  const [showPromotionModal, setShowPromotionModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    const init = async () => {
      try {
        const roleData = await api.get<{ id: number; role_name: string }[]>("/roles/");
        setRoles(roleData);

        const types = await api.get<any>("/leave/types");
        setLeaveTypes(types);

        // Fetch designations list so we can look up names by ID
        const designationList = await api.get<{ id: number; name: string }[]>("/designations/");
        const nameMap: Record<number, string> = {};
        designationList.forEach((d) => { nameMap[d.id] = d.name; });
        setDesignationNames(nameMap);

        const employeeData = await api.get<any>(`/employees/${id}`);

        if (employeeData.user_id === user?.id) {
          router.replace("/dashboard/employees");
          return;
        }

        // Store the initial designation ID to detect if it changes
        setInitialDesignationId(employeeData.designation_id || null);

        // Check if the current designation has already had a promotion letter sent
        let letterSent = false;
        if (employeeData.designation_history && employeeData.designation_history.length > 0) {
          // Sort descending by start_date to find the active/most recent record
          const sorted = [...employeeData.designation_history].sort((a, b) => 
            new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
          );
          if (sorted[0].designation_id === employeeData.designation_id) {
            letterSent = sorted[0].promotion_letter_sent || false;
          }
        }
        setInitialPromotionLetterSent(letterSent);

        setFormData({
          employeeId: employeeData.employee_id,
          firstName: employeeData.first_name, lastName: employeeData.last_name,
          email: employeeData.email, phone: employeeData.phone, address: employeeData.address || "",
          dateOfBirth: employeeData.date_of_birth || "", gender: employeeData.gender || "",
          maritalStatus: employeeData.marital_status || "", nationality: employeeData.nationality || "",
          emergencyContactName: employeeData.emergency_contact_name || "",
          emergencyContactPhone: employeeData.emergency_contact_phone || "",
          emergencyContactRelation: employeeData.emergency_contact_relation || "",
          skills: employeeData.skills || "", qualifications: employeeData.qualifications || "",
          bankName: employeeData.bank_name || "", bankAccountNo: employeeData.bank_account_no || "", bankBranch: employeeData.bank_branch || "",
          work: {
            departmentId: employeeData.department_id,
            roleId: employeeData.role?.id || null,
            designationId: employeeData.designation_id || null,
            designationStartDate: "",
            designationEndDate: "",
            joinedDate: employeeData.joined_date || "",
            status: employeeData.status
          }
        });

        // Show additional info if any exists
        if (employeeData.date_of_birth || employeeData.emergency_contact_name || employeeData.skills || employeeData.bank_name) {
          setShowAdditionalInfo(true);
        }
      } catch (err) {
        console.error("Failed to fetch initial data", err);
      } finally {
        setPageLoading(false);
      }
    };
    init();
  }, [id]);

  const handleSave = async (redirectToRole: boolean = false) => {
    if (!formData.employeeId || !formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.work.designationId || !formData.work.departmentId || !formData.work.roleId) {
      setError("Please fill in all required fields marked with *.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const leave_entitlements = Object.entries(customLeaveEntitlements)
        .filter(([_, value]) => value !== "")
        .map(([typeId, value]) => ({ leave_type_id: parseInt(typeId), days: parseFloat(value) }));

      if (leave_entitlements.some((e) => Number.isNaN(e.days) || e.days < 0 || e.days > 365)) {
        throw new Error("Pre-assigned leave days must be between 0 and 365.");
      }

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
      };

      await api.put(`/employees/${id}`, payload);
      const created = { id: parseInt(id as string) };
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


  if (pageLoading) return <div className="p-10 text-center text-gray-400">Loading details...</div>;

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
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Employee</h1>
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
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
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
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}
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
                onChange={(desigId) => setFormData({ ...formData, work: { ...formData.work, designationId: desigId } })}
                selectClass={selectCls}
              />
            </FormField>

            {/* Promotion Letter Action */}
            {formData.work.designationId && 
             (formData.work.designationId !== initialDesignationId || !initialPromotionLetterSent) && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#EE7F22]/5 border border-[#EE7F22]/20 rounded-xl mt-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#EE7F22]/10 flex items-center justify-center text-[#EE7F22] flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </div>
                  <div>
                    {formData.work.designationId !== initialDesignationId ? (
                      <>
                        <p className="text-xs font-semibold text-[#EE7F22]">Designation Changed</p>
                        <p className="text-[11px] text-gray-500">You can send a promotion letter after saving the changes.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-[#EE7F22]">Promotion Letter</p>
                        <p className="text-[11px] text-gray-500">Generate and send a promotion letter for the current designation.</p>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPromotionModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#EE7F22] text-white text-xs font-semibold rounded-lg hover:bg-orange-600 transition-colors shadow-sm whitespace-nowrap flex-shrink-0"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  Send Promotion Letter
                </button>
              </div>
            )}

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
                    className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${formData.work.status === "inactive" ? "bg-white text-gray-700 shadow-sm border border-gray-200" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${formData.work.status === "inactive" ? "bg-gray-500" : "bg-gray-300"}`} />
                      <span className="leading-none pt-[1px]">Inactive</span>
                    </span>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Set Designation Period & Leave Overrides
          </button>
        ) : (
          <SectionCard
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
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
              <div>
                <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wider mb-3">Leave Overrides for this period</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {leaveTypes.map((type) => {
                    const hasCustom = !!customLeaveEntitlements[type.id];
                    return (
                      <div key={type.id} className={`border rounded-xl p-4 transition-all ${hasCustom ? "border-[#EE7F22]/30 bg-[#EE7F22]/10/50" : "border-gray-100 bg-gray-50/50"}`}>
                        <span className="block text-[12px] font-bold text-gray-700 uppercase tracking-wider truncate">
                          {type.name}
                        </span>
                        <div className="text-[11px] text-gray-400 mt-1">
                          Default: <span className="font-semibold text-gray-600">{type.default_days != null ? `${type.default_days} days` : "Unlimited"}</span>
                        </div>
                        <div className="mt-3 relative">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            placeholder="Custom limit..."
                            value={customLeaveEntitlements[type.id] || ""}
                            onChange={(e) => {
                              setCustomLeaveEntitlements({ ...customLeaveEntitlements, [type.id]: e.target.value });
                            }}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[13px] text-gray-900 outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] transition-colors"
                          />
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
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Additional Information (Optional)
          </button>
        )}

        {showAdditionalInfo && (
          <>
            {/* Personal Information */}
            <SectionCard
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>}
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
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.36 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
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
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
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
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}
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
            <svg className="mt-0.5 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {isSubmitting ? "Saving…" : "Save & Assign Role"}
            </button>
          </div>
        </div>
      </div>

      {/* Promotion Letter Modal */}
      {showPromotionModal && formData.work.designationId && (
        <PromotionLetterModal
          employeeId={parseInt(id as string)}
          newDesignationId={formData.work.designationId}
          effectiveDate={formData.work.designationStartDate || undefined}
          onClose={() => setShowPromotionModal(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
}


export default function EmployeeEditPage() {
  return (
    <React.Suspense fallback={<div className="p-10 text-center text-gray-400">Loading details...</div>}>
      <EmployeeEditContent />
    </React.Suspense>
  );
}
