"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconArrowLeft, IconChevron } from "@/components/Icons";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface Permission {
  id: number;
  permission_name: string;
  description?: string;
}

interface Role {
  id: number;
  role_name: string;
  description?: string;
  permissions: Permission[];
}

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  user_id?: number | null;
  role?: { id: number; role_name: string };
}

function AssignRoleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const { hasPermission, loading: authLoading } = useAuth();

  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    if (!authLoading && !hasPermission("role:assign")) {
      router.replace("/dashboard/employees");
    }
  }, [authLoading, hasPermission, router]);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [assignmentOption, setAssignmentOption] = useState<"existing" | "custom">("existing");
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [isEditingExistingRole, setIsEditingExistingRole] = useState(false);

  const [customRoleName, setCustomRoleName] = useState("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rolesData, permsData] = await Promise.all([
          api.get<Role[]>("/roles/"),
          api.get<Permission[]>("/roles/permissions"),
        ]);
        setRoles(rolesData);
        setAllPermissions(permsData);

        if (id) {
          const empData = await api.get<Employee>(`/employees/${id}`);
          setEmployee(empData);
          if (empData.role) {
            setSelectedRoleId(empData.role.id);
          } else if (rolesData.length > 0) {
            setSelectedRoleId(rolesData[0].id);
          }
        } else if (rolesData.length > 0) {
          setSelectedRoleId(rolesData[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch RBAC data:", error);
        setErrorMsg("Failed to load roles and permissions. Please refresh.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const selectedRole = roles.find(r => r.id === selectedRoleId);

  // When selected role changes, reset edit mode
  useEffect(() => {
    setIsEditingExistingRole(false);
    setSelectedPermissionIds([]);
  }, [selectedRoleId]);

  const handleTogglePermission = (pid: number) => {
    setSelectedPermissionIds(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    );
  };

  const startEditingRole = () => {
    if (!selectedRole) return;
    setIsEditingExistingRole(true);
    setSelectedPermissionIds(selectedRole.permissions.map(p => p.id));
  };

  const handleSave = async () => {
    if (!id) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      let roleIdToAssign = selectedRoleId;

      // Case 1: Updating an existing role's permissions
      if (assignmentOption === "existing" && isEditingExistingRole && selectedRoleId) {
        if (selectedPermissionIds.length === 0) {
          setErrorMsg("Please select at least one permission.");
          setIsSubmitting(false);
          return;
        }
        await api.put(`/roles/${selectedRoleId}`, {
          permission_ids: selectedPermissionIds,
        });
      }

      // Case 2: Creating a completely new custom role
      if (assignmentOption === "custom") {
        if (!customRoleName.trim()) {
          setErrorMsg("Please enter a name for the custom role.");
          setIsSubmitting(false);
          return;
        }
        if (selectedPermissionIds.length === 0) {
          setErrorMsg("Please select at least one permission for the custom role.");
          setIsSubmitting(false);
          return;
        }
        const newRole = await api.post<Role>("/roles", {
          role_name: customRoleName.trim(),
          description: "Custom user-defined role",
          permission_ids: selectedPermissionIds,
        });
        roleIdToAssign = newRole.id;
      }

      const roleName = assignmentOption === "custom"
        ? customRoleName
        : roles.find(r => r.id === roleIdToAssign)?.role_name || "Role";

      if (id) {
        // Final step: Assign the role (new or updated) to the employee
        if (!employee?.user_id) {
          setErrorMsg("Cannot assign role: This employee is not linked to a system user account. Please create a user account for them first.");
          setIsSubmitting(false);
          return;
        }

        if (!roleIdToAssign) {
          setErrorMsg("Please select a role to assign.");
          setIsSubmitting(false);
          return;
        }

        await api.post("/roles/assign", {
          user_id: employee.user_id,
          role_ids: [roleIdToAssign],
        });

        setSuccessMsg(`✓ "${roleName}" permissions updated and assigned to ${employee?.first_name ?? "the employee"}.`);
        setTimeout(() => router.push("/dashboard/employees"), 2000);
      } else {
        setSuccessMsg(`✓ Role "${roleName}" successfully saved.`);
        setIsEditingExistingRole(false);
        if (assignmentOption === "custom") {
          setTimeout(() => window.location.reload(), 1500);
        }
      }
    } catch (error: unknown) {
      let msg = "Failed to save role assignment.";
      if (error instanceof Error) {
        msg = error.message;
      } else if (typeof error === 'string') {
        msg = error;
      } else {
        console.error('Unexpected error object:', error);
        msg = JSON.stringify(error);
      }
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const categorizedPermissions = allPermissions.reduce((acc, perm) => {
    const category = perm.description?.replace(" Permission", "") || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const categorizedSelectedPermissions = selectedRole?.permissions.reduce((acc, perm) => {
    const category = perm.description?.replace(" Permission", "") || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>) || {};

  const StepCircle = ({ num, active, completed }: { num: number; active?: boolean; completed?: boolean }) => (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold border-2 transition-all duration-300 ${active ? "bg-[#EE7F22] border-[#EE7F22] text-white shadow-lg shadow-[#EE7F22]/20 scale-110" :
      completed ? "bg-[#EE7F22]/10 border-[#EE7F22] text-[#EE7F22]" :
        "bg-white border-gray-200 text-gray-400"
      }`}>
      {completed ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      ) : num}
    </div>
  );

  if (loading) return (
    <div className="max-w-[1000px] mx-auto pb-20 pt-2 space-y-6" aria-hidden="true">
      {/* Header skeleton */}
      <div className="mb-8 space-y-2">
        <div className="skeleton-shimmer h-3.5 w-12 rounded" />
        <div className="skeleton-shimmer h-8 w-64 rounded-lg mt-2" />
        <div className="skeleton-shimmer h-4 w-48 rounded" />
      </div>
      {/* Step bar skeleton */}
      <div className="flex items-center gap-4 mb-10 px-4">
        <div className="skeleton-shimmer w-8 h-8 rounded-full" />
        <div className="skeleton-shimmer h-3.5 w-28 rounded" />
        <div className="skeleton-shimmer w-16 h-[2px] rounded" />
        <div className="skeleton-shimmer w-8 h-8 rounded-full" />
        <div className="skeleton-shimmer h-3.5 w-36 rounded" />
      </div>
      {/* Option cards skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
        <div className="skeleton-shimmer h-3.5 w-36 rounded mb-6" />
        <div className="grid grid-cols-2 gap-4">
          <div className="skeleton-shimmer h-20 rounded-xl" />
          <div className="skeleton-shimmer h-20 rounded-xl" />
        </div>
      </div>
      {/* Permissions skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
        <div className="skeleton-shimmer h-4 w-24 rounded mb-4" />
        <div className="skeleton-shimmer h-12 w-72 rounded-lg mb-8" />
        {[1, 2].map(n => (
          <div key={n} className="bg-gray-50 rounded-xl p-6 mb-4">
            <div className="skeleton-shimmer h-3.5 w-28 rounded mb-4" />
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton-shimmer h-11 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-[1000px] mx-auto pb-20 pt-2">
      <div className="mb-8">
        <Link
          href={id ? `/dashboard/EmployeeManagement/edit?id=${encodeURIComponent(id)}` : "/dashboard"}
          className="inline-flex items-center gap-2 text-[14px] text-gray-500 hover:text-gray-800 transition-colors mb-4 font-medium"
        >
          <IconArrowLeft /> Back
        </Link>
        <h1 className="text-[28px] font-bold text-[#212B36]">{id ? "Assign Role & Permissions" : "Role Management"}</h1>
        <p className="text-[14px] text-gray-400 mt-1">
          {employee ? `Defining access for ${employee.first_name} ${employee.last_name}` : "Create and manage system roles and permissions"}
        </p>
        {employee?.role && (
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-orange-50 border border-orange-200 rounded-full text-[13px] text-orange-700 font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div>
            Current role: <strong>{employee.role.role_name}</strong>
          </div>
        )}
      </div>

      {id && (
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
      )}

      {successMsg && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-[14px] font-medium flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          {successMsg} Redirecting...
        </div>
      )}
      {errorMsg && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-[14px] max-h-[100px] overflow-y-auto whitespace-pre-wrap break-words">{errorMsg}</div>}
      {employee && !employee.user_id && (
        <div className="mb-6 p-5 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex gap-3 text-amber-800">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <div>
              <p className="text-[15px] font-bold">System User Account Required</p>
              <p className="text-[14px] mt-1 opacity-90">This employee does not have a linked system user account. Roles and permissions can only be assigned to employees with active system access.</p>
              <button
                type="button"
                className="mt-3 px-4 py-1.5 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg text-[13px] font-bold transition-colors"
                onClick={() => alert("User creation logic to be implemented or handled via User Management.")}
              >
                Setup User Account
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          <h2 className="text-[14px] font-bold text-gray-400 uppercase tracking-wider mb-6">Assignment Option</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className={`flex items-start gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${assignmentOption === "existing" ? "border-[#EE7F22] bg-[#EE7F22]/5" : "border-gray-100 hover:border-gray-200"}`}>
              <input type="radio" name="assignmentOption" className="mt-1 accent-[#EE7F22] w-4 h-4" checked={assignmentOption === "existing"} onChange={() => setAssignmentOption("existing")} />
              <div>
                <p className={`text-[15px] font-bold ${assignmentOption === "existing" ? "text-[#EE7F22]" : "text-[#212B36]"}`}>Select Existing Role</p>
                <p className="text-[13px] text-gray-500 mt-1">Choose from predefined roles with preset permissions</p>
              </div>
            </label>
            <label className={`flex items-start gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${assignmentOption === "custom" ? "border-[#EE7F22] bg-[#EE7F22]/5" : "border-gray-100 hover:border-gray-200"}`}>
              <input type="radio" name="assignmentOption" className="mt-1 accent-[#EE7F22] w-4 h-4" checked={assignmentOption === "custom"} onChange={() => setAssignmentOption("custom")} />
              <div>
                <p className={`text-[15px] font-bold ${assignmentOption === "custom" ? "text-[#EE7F22]" : "text-[#212B36]"}`}>Create Custom Role</p>
                <p className="text-[13px] text-gray-500 mt-1">Define a new role with specific permissions</p>
              </div>
            </label>
          </div>
        </div>

        {assignmentOption === "existing" ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
            <div className="mb-8">
              <label className="block text-[12px] font-bold text-gray-700 uppercase mb-2">Role</label>
              <div className="relative max-w-md">
                <select
                  value={selectedRoleId || ""}
                  onChange={(e) => setSelectedRoleId(parseInt(e.target.value))}
                  className="w-full h-[48px] px-4 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] appearance-none cursor-pointer"
                >
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.role_name}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <IconChevron />
                </div>
              </div>
              {selectedRole && <p className="text-[13px] text-gray-500 mt-3 italic">{selectedRole.description}</p>}
            </div>

            {selectedRole && (
              <div className="mt-10">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[16px] font-bold text-[#212B36]">
                    {isEditingExistingRole ? `Editing "${selectedRole.role_name}" Permissions` : "Permission Summary"}
                  </h3>
                  {!isEditingExistingRole && (
                    <button
                      type="button"
                      onClick={startEditingRole}
                      className="text-[13px] text-[#EE7F22] font-bold hover:underline"
                    >
                      Edit Permissions
                    </button>
                  )}
                  {isEditingExistingRole && (
                    <button
                      type="button"
                      onClick={() => setIsEditingExistingRole(false)}
                      className="text-[13px] text-gray-400 font-bold hover:underline"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {(isEditingExistingRole ? Object.entries(categorizedPermissions) : Object.entries(categorizedSelectedPermissions)).map(([category, perms]) => (
                    <div key={category} className="bg-[#F8F9FB] rounded-xl p-6 border border-gray-50">
                      <h4 className="text-[14px] font-bold text-[#637381] mb-5 uppercase tracking-wider">{category}</h4>
                      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isEditingExistingRole ? 'lg:grid-cols-3' : ''} gap-4`}>
                        {perms.map((perm, idx) => (
                          isEditingExistingRole ? (
                            <label key={perm.id} className={`flex items-center gap-3 p-3.5 rounded-lg border-2 transition-all cursor-pointer ${selectedPermissionIds.includes(perm.id) ? "bg-white border-[#EE7F22] shadow-sm" : "bg-white/50 border-transparent hover:border-gray-100"}`}>
                              <input
                                type="checkbox"
                                className="w-4 h-4 accent-[#EE7F22] rounded cursor-pointer"
                                checked={selectedPermissionIds.includes(perm.id)}
                                onChange={() => handleTogglePermission(perm.id)}
                              />
                              <span className={`text-[14px] font-medium ${selectedPermissionIds.includes(perm.id) ? "text-[#212B36]" : "text-gray-500"}`}>{perm.permission_name}</span>
                            </label>
                          ) : (
                            <div key={idx} className="flex items-center gap-3 group">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#EE7F22] flex-shrink-0 group-hover:scale-125 transition-transform"></div>
                              <span className="text-[14px] text-[#212B36] font-medium leading-tight">{perm.permission_name}</span>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {isEditingExistingRole && (
                  <p className="text-[13px] text-gray-400 mt-4 italic">
                    * Note: Changing permissions for this role will affect ALL employees currently assigned to it.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
            <div className="mb-8">
              <label className="block text-[12px] font-bold text-gray-700 uppercase mb-2">Role Name</label>
              <input type="text" placeholder="e.g., Finance Manager" value={customRoleName} onChange={(e) => setCustomRoleName(e.target.value)} className="w-full max-w-md h-[48px] px-4 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] transition-all" />
            </div>
            <div className="space-y-4">
              {Object.entries(categorizedPermissions).map(([category, perms]) => (
                <div key={category} className="bg-[#F8F9FB] rounded-xl p-6 border border-gray-50">
                  <h4 className="text-[14px] font-bold text-[#637381] mb-5 uppercase tracking-wider">{category}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {perms.map((perm) => (
                      <label key={perm.id} className={`flex items-center gap-3 p-3.5 rounded-lg border-2 transition-all cursor-pointer ${selectedPermissionIds.includes(perm.id) ? "bg-white border-[#EE7F22] shadow-sm" : "bg-white/50 border-transparent hover:border-gray-100"}`}>
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-[#EE7F22] rounded cursor-pointer"
                          checked={selectedPermissionIds.includes(perm.id)}
                          onChange={() => handleTogglePermission(perm.id)}
                        />
                        <span className={`text-[14px] font-medium ${selectedPermissionIds.includes(perm.id) ? "text-[#212B36]" : "text-gray-500"}`}>{perm.permission_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-10">
          <button type="button" onClick={() => router.back()} disabled={isSubmitting || !!successMsg} className="px-8 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-[14px] hover:bg-gray-50 transition-colors disabled:opacity-50">Cancel</button>
          <button type="button" onClick={handleSave} disabled={isSubmitting || !!successMsg} className="px-8 py-2.5 rounded-xl bg-[#EE7F22] text-white font-bold text-[14px] hover:bg-[#d66f1b] shadow-sm hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-50">
            {isSubmitting ? <span>Saving...</span> : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                {id ? (
                  assignmentOption === "custom" ? "Create & Assign Role" :
                  isEditingExistingRole ? "Apply Changes & Assign" : "Confirm Assignment"
                ) : (
                  assignmentOption === "custom" ? "Create Role" : "Save Changes"
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AssignRolePage() {
  return (
    <React.Suspense fallback={
      <div className="max-w-[1000px] mx-auto pb-20 pt-2 space-y-6" aria-hidden="true">
        <div className="skeleton-shimmer h-8 w-64 rounded-lg" />
        <div className="skeleton-shimmer h-40 rounded-xl" />
        <div className="skeleton-shimmer h-64 rounded-xl" />
      </div>
    }>
      <AssignRoleContent />
    </React.Suspense>
  );
}
