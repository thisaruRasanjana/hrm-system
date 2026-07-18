"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Shield, Plus, Pencil, Trash2, Check, Lock, AlertCircle, ChevronDown, UserPlus,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import ConfirmModal from "@/app/components/ConfirmModal";

interface Permission {
  id: number;
  permission_name: string;
  resource?: string;
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

// Built-in roles seeded by the backend
const SYSTEM_ROLE_NAMES = ["Super Admin", "HR", "Manager", "Employee"];

// Map a permission's `resource` field to a friendly category label + sort order.
const RESOURCE_META: Record<string, { label: string; order: number }> = {
  employee:      { label: "Employee Management", order: 1 },
  role:          { label: "Roles & Permissions", order: 2 },
  recruitment:   { label: "Recruitment",         order: 3 },
  document:      { label: "Document Management",  order: 4 },
  leave:         { label: "Leave Management",     order: 5 },
  dashboard:     { label: "Dashboard & Widgets",  order: 6 },
  messaging:     { label: "Messaging",            order: 7 },
};

/** Group permissions by their `resource` into ordered [resource, permissions] pairs. */
const categorize = (perms: Permission[]): [string, Permission[]][] => {
  const groups: Record<string, Permission[]> = {};
  for (const p of perms) {
    const key = p.resource || "other";
    (groups[key] = groups[key] || []).push(p);
  }
  return Object.entries(groups).sort(
    ([a], [b]) => (RESOURCE_META[a]?.order ?? 99) - (RESOURCE_META[b]?.order ?? 99)
  );
};

const categoryLabel = (key: string) => RESOURCE_META[key]?.label ?? key;
const prettyLabel = (perm: Permission) => perm.description || perm.permission_name;

function AssignRoleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const { hasPermission, hasAnyPermission, loading: authLoading, user } = useAuth();

  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    if (authLoading) return;
    const allowed = id
      ? hasPermission("role:assign")
      : hasAnyPermission(["role:view", "role:create", "role:assign"]);
    if (!allowed) {
      router.replace("/dashboard/employees");
    }
  }, [authLoading, hasPermission, hasAnyPermission, id, router]);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [assignmentOption, setAssignmentOption] = useState<"existing" | "custom">("existing");
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [isEditingExistingRole, setIsEditingExistingRole] = useState(false);

  const [customRoleName, setCustomRoleName] = useState("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);

  useEffect(() => {
    if (authLoading || !user) return;
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
  }, [id, authLoading, user]);

  const selectedRole = roles.find(r => r.id === selectedRoleId);
  const selectedIsSystem = !!selectedRole && SYSTEM_ROLE_NAMES.includes(selectedRole.role_name);

  useEffect(() => {
    setIsEditingExistingRole(false);
    setSelectedPermissionIds([]);
  }, [selectedRoleId]);

  useEffect(() => {
    setIsEditingExistingRole(false);
    setSelectedPermissionIds([]);
  }, [assignmentOption]);

  const refreshRoles = async (): Promise<Role[]> => {
    try {
      const rolesData = await api.get<Role[]>("/roles/");
      setRoles(rolesData);
      return rolesData;
    } catch (error) {
      console.error("Failed to refresh roles:", error);
      return roles;
    }
  };

  const openDeleteConfirm = () => {
    if (!selectedRole || selectedIsSystem) return;
    setShowDeleteConfirm(true);
  };

  const confirmDeleteRole = async () => {
    if (!selectedRole) return;
    setIsDeleting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const result = await api.delete(`/roles/${selectedRole.id}`) as { unassigned_users?: number };
      const deletedName = selectedRole.role_name;
      const n = result?.unassigned_users ?? 0;
      const rolesData = await refreshRoles();
      setSelectedRoleId(rolesData.length > 0 ? rolesData[0].id : null);
      setIsEditingExistingRole(false);
      setShowDeleteConfirm(false);
      setSuccessMsg(
        n > 0
          ? `Role "${deletedName}" deleted and unassigned from ${n} user${n === 1 ? "" : "s"}.`
          : `Role "${deletedName}" deleted.`
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (error: unknown) {
      setShowDeleteConfirm(false);
      setErrorMsg(error instanceof Error ? error.message : "Failed to delete role.");
    } finally {
      setIsDeleting(false);
    }
  };

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
        const newRole = await api.post<Role>("/roles/", {
          role_name: customRoleName.trim(),
          description: "Custom user-defined role",
          permission_ids: selectedPermissionIds,
        });
        roleIdToAssign = newRole.id;
      }

      if (!id && assignmentOption === "existing" && !isEditingExistingRole) {
        setErrorMsg('Nothing to save. Click "Edit Permissions" to change this role, or pick "Create Custom Role".');
        setIsSubmitting(false);
        return;
      }

      // If assigning to an employee
      if (id && roleIdToAssign) {
        await api.put(`/employees/${id}/role`, { role_id: roleIdToAssign });
        setSuccessMsg("Role & permissions assigned successfully.");
        setTimeout(() => router.push(`/dashboard/EmployeeManagement/edit?id=${id}`), 1000);
      } else {
        await refreshRoles();
        if (assignmentOption === "custom") {
          setCustomRoleName("");
          setAssignmentOption("existing");
          setSelectedRoleId(roleIdToAssign);
        }
        setIsEditingExistingRole(false);
        setSuccessMsg("Role saved successfully.");
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (error: any) {
      let msg = "An error occurred while saving.";
      if (error?.detail && Array.isArray(error.detail)) {
        msg = error.detail.map((e: any) => e.msg || e.type).join(", ");
      } else if (error?.detail) {
        msg = typeof error.detail === "string" ? error.detail : JSON.stringify(error.detail);
      } else if (error instanceof Error) {
        msg = error.message;
      } else {
        msg = JSON.stringify(error);
      }
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Reusable permission renderers ───────────────────────────────────────────
  const PermissionCheckbox = ({ perm }: { perm: Permission }) => {
    const checked = selectedPermissionIds.includes(perm.id);
    return (
      <label
        className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
          checked ? "bg-[#f08a4b]/5 border-[#f08a4b]" : "bg-white border-gray-100 hover:border-gray-200 shadow-sm hover:shadow-md"
        }`}
      >
        <span className="relative mt-0.5 flex-shrink-0 inline-flex">
          <input
            type="checkbox"
            className="peer appearance-none w-4 h-4 rounded border-2 border-gray-300 bg-white transition-colors cursor-pointer focus:outline-none checked:bg-[#f08a4b] checked:border-[#f08a4b]"
            checked={checked}
            onChange={() => handleTogglePermission(perm.id)}
          />
          <Check size={12} strokeWidth={3.5} className="pointer-events-none absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100" />
        </span>
        <div className="min-w-0">
          <p className={`text-sm font-bold leading-tight ${checked ? "text-[#f08a4b]" : "text-gray-700"}`}>
            {prettyLabel(perm)}
          </p>
          <p className="text-[11px] text-gray-400 font-medium mt-1 truncate tracking-wide">{perm.permission_name}</p>
        </div>
      </label>
    );
  };

  const PermissionBullet = ({ perm }: { perm: Permission }) => (
    <div className="flex items-start gap-3 p-3.5 rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="w-5 h-5 rounded-full bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Check size={12} strokeWidth={3} className="text-green-600" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-700 font-bold leading-tight">{prettyLabel(perm)}</p>
        <p className="text-[11px] text-gray-400 font-medium tracking-wide mt-1 truncate">{perm.permission_name}</p>
      </div>
    </div>
  );

  const CategoryCard = ({
    categoryKey, perms, mode,
  }: { categoryKey: string; perms: Permission[]; mode: "edit" | "view" }) => (
    <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100 shadow-inner">
      <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#f08a4b]" />
        {categoryLabel(categoryKey)}
        <span className="ml-auto text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md normal-case">{perms.length} Permissions</span>
      </h4>
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${mode === "edit" ? "lg:grid-cols-3" : ""} gap-3`}>
        {perms.map(perm =>
          mode === "edit"
            ? <PermissionCheckbox key={perm.id} perm={perm} />
            : <PermissionBullet key={perm.id} perm={perm} />
        )}
      </div>
    </div>
  );

  const StepCircle = ({ num, active, completed }: { num: number; active?: boolean; completed?: boolean }) => (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold border-2 transition-all duration-300 ${
      active ? "bg-[#f08a4b] border-[#f08a4b] text-white shadow-md shadow-orange-100 scale-110" :
      completed ? "bg-orange-50 border-orange-100 text-[#f08a4b]" :
      "bg-white border-gray-200 text-gray-400"
    }`}>
      {completed ? <Check size={16} strokeWidth={3} /> : num}
    </div>
  );

  const inputClass = "w-full border border-gray-200 rounded-xl p-3 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] bg-white transition";

  if (loading) return (
    <div className="max-w-[1000px] mx-auto pb-20 pt-2 space-y-6" aria-hidden="true">
      <div className="mb-8 space-y-2">
        <div className="skeleton-shimmer h-3.5 w-12 rounded" />
        <div className="skeleton-shimmer h-8 w-64 rounded-lg mt-2" />
        <div className="skeleton-shimmer h-4 w-48 rounded" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="skeleton-shimmer h-3.5 w-36 rounded mb-6" />
        <div className="grid grid-cols-2 gap-4">
          <div className="skeleton-shimmer h-20 rounded-2xl" />
          <div className="skeleton-shimmer h-20 rounded-2xl" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1000px] mx-auto pb-20 pt-2 space-y-8">
      {/* Header */}
      <div>
        <Link
          href={id ? `/dashboard/EmployeeManagement/edit?id=${encodeURIComponent(id)}` : "/dashboard"}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-3 font-medium"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-1">
          <Shield size={22} className="text-[#f08a4b]" />
          {id ? "Assign Role & Permissions" : "Role Management"}
        </h1>
        <p className="text-sm text-gray-400 font-medium">
          {employee ? `Defining access for ${employee.first_name} ${employee.last_name}` : "Create and manage system roles and permissions."}
        </p>
        {employee?.role && (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-[#f08a4b]/10 border border-[#f08a4b]/20 rounded-full text-[13px] text-[#f08a4b] font-bold shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f08a4b]" />
            Current role: <span>{employee.role.role_name}</span>
          </div>
        )}
      </div>

      {/* Step bar (only when assigning to a specific employee) */}
      {id && (
        <div className="flex items-center gap-4 px-1">
          <div className="flex items-center gap-3">
            <StepCircle num={1} completed />
            <span className="text-sm font-bold text-gray-500">Employee Details</span>
          </div>
          <div className="w-16 h-[2px] bg-[#f08a4b] shadow-sm" />
          <div className="flex items-center gap-3">
            <StepCircle num={2} active />
            <span className="text-sm font-bold text-gray-900">Assign Role &amp; Permissions</span>
          </div>
        </div>
      )}

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm font-bold flex items-center gap-3">
          <Check size={18} strokeWidth={3} className="text-green-600" />
          {successMsg}{id ? " Redirecting..." : ""}
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-bold flex items-start gap-3">
          <AlertCircle size={18} strokeWidth={2.5} className="flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {employee && !employee.user_id && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
          <AlertCircle size={20} className="flex-shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="text-[14px] font-bold text-amber-800">System User Account Required</p>
            <p className="text-sm mt-0.5 font-medium text-amber-700/80">This employee does not have a linked system user account. Roles and permissions can only be assigned to employees with active system access.</p>
          </div>
        </div>
      )}

      {/* Assignment Option */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Shield size={16} className="text-[#f08a4b]" />
            {id ? "Assignment Option" : "What do you want to do?"}
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className={`flex items-start gap-3 p-5 rounded-xl border transition-all duration-200 cursor-pointer ${assignmentOption === "existing" ? "border-[#f08a4b] bg-[#f08a4b]/5 shadow-sm" : "border-gray-200 hover:border-[#f08a4b]/50"}`}>
              <input type="radio" name="assignmentOption" className="mt-1 appearance-none w-4 h-4 rounded-full border-2 border-gray-300 bg-white transition-colors cursor-pointer focus:outline-none checked:border-[#f08a4b] checked:bg-[#f08a4b] checked:shadow-[inset_0_0_0_2px_#ffffff]" checked={assignmentOption === "existing"} onChange={() => setAssignmentOption("existing")} />
              <div>
                <p className={`text-sm font-bold ${assignmentOption === "existing" ? "text-[#f08a4b]" : "text-gray-800"}`}>Select Existing Role</p>
                <p className={`text-xs mt-1 font-medium ${assignmentOption === "existing" ? "text-gray-600" : "text-gray-500"}`}>View, edit or {id ? "assign" : "manage"} a predefined role and its permissions</p>
              </div>
            </label>
            <label className={`flex items-start gap-3 p-5 rounded-xl border transition-all duration-200 cursor-pointer ${assignmentOption === "custom" ? "border-[#f08a4b] bg-[#f08a4b]/5 shadow-sm" : "border-gray-200 hover:border-[#f08a4b]/50"}`}>
              <input type="radio" name="assignmentOption" className="mt-1 appearance-none w-4 h-4 rounded-full border-2 border-gray-300 bg-white transition-colors cursor-pointer focus:outline-none checked:border-[#f08a4b] checked:bg-[#f08a4b] checked:shadow-[inset_0_0_0_2px_#ffffff]" checked={assignmentOption === "custom"} onChange={() => setAssignmentOption("custom")} />
              <div>
                <p className={`text-sm font-bold ${assignmentOption === "custom" ? "text-[#f08a4b]" : "text-gray-800"}`}>Create Custom Role</p>
                <p className={`text-xs mt-1 font-medium ${assignmentOption === "custom" ? "text-gray-600" : "text-gray-500"}`}>Define a brand-new role with a specific set of permissions</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* ── Existing role panel ─────────────────────────────────────────────── */}
      {assignmentOption === "existing" ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Shield size={16} className="text-[#f08a4b]" /> Role Configuration
            </h3>
            {selectedRole && !isEditingExistingRole && (
              <button
                type="button"
                onClick={startEditingRole}
                className="inline-flex items-center gap-1.5 text-xs text-[#f08a4b] font-bold hover:underline"
              >
                <Pencil size={13} /> Edit Permissions
              </button>
            )}
            {selectedRole && isEditingExistingRole && (
              <button
                type="button"
                onClick={() => setIsEditingExistingRole(false)}
                className="text-xs text-gray-400 font-bold hover:underline"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="p-6">
            <div className="mb-8">
              <label className="block text-sm font-bold text-gray-700 mb-2">Role Selection</label>
              <div className="relative max-w-md">
                <select
                  value={selectedRoleId || ""}
                  onChange={(e) => setSelectedRoleId(parseInt(e.target.value))}
                  className={`${inputClass} appearance-none cursor-pointer`}
                >
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.role_name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
              
              {selectedRole?.description && <p className="text-[13px] text-gray-500 font-medium mt-2">{selectedRole.description}</p>}

              {selectedRole && selectedIsSystem && (
                <div className="mt-4 inline-flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 font-bold">
                  <Lock size={13} /> Built-in system role — protected from deletion
                </div>
              )}

              {!id && selectedRole && !selectedIsSystem && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={openDeleteConfirm}
                    disabled={isDeleting || isSubmitting || !!successMsg}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                    {isDeleting ? "Deleting..." : "Delete this role"}
                  </button>
                </div>
              )}
            </div>

            {selectedRole && (
              <div>
                <div className="mb-4 flex items-center justify-between border-t border-gray-50 pt-8">
                  <h3 className="text-sm font-bold text-gray-800">
                    {isEditingExistingRole ? `Editing "${selectedRole.role_name}" Permissions` : "Permission Summary"}
                  </h3>
                </div>

                {(!isEditingExistingRole && selectedRole.permissions.length === 0) ? (
                  <p className="text-sm font-medium text-gray-400 bg-gray-50/50 border border-gray-100 rounded-xl p-8 text-center">
                    This role has no permissions yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {categorize(isEditingExistingRole ? allPermissions : selectedRole.permissions).map(([key, perms]) => (
                      <CategoryCard key={key} categoryKey={key} perms={perms} mode={isEditingExistingRole ? "edit" : "view"} />
                    ))}
                  </div>
                )}

                {isEditingExistingRole && (
                  <p className="text-[12px] text-amber-600 font-bold mt-4 flex items-center gap-1.5 bg-amber-50 border border-amber-100 p-3 rounded-lg">
                    <AlertCircle size={14} /> Changing permissions for this role affects ALL users assigned to it.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Custom role panel ─────────────────────────────────────────────── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Plus size={16} className="text-[#f08a4b]" /> Create Custom Role
            </h3>
          </div>
          
          <div className="p-6">
            <div className="mb-8 max-w-md">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Finance Manager"
                value={customRoleName}
                onChange={(e) => setCustomRoleName(e.target.value)}
                className={inputClass}
              />
            </div>
            
            <div className="mb-4 flex items-center justify-between border-t border-gray-50 pt-8">
              <label className="block text-sm font-bold text-gray-800">
                Permissions <span className="text-gray-400 normal-case font-medium ml-1">({selectedPermissionIds.length} selected)</span>
              </label>
            </div>
            
            <div className="space-y-4">
              {categorize(allPermissions).map(([key, perms]) => (
                <CategoryCard key={key} categoryKey={key} perms={perms} mode="edit" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer actions */}
      {(id || assignmentOption === "custom" || isEditingExistingRole) && (
        <div className="flex justify-end gap-3 mt-8">
          <button
            type="button"
            onClick={() => {
              if (id) {
                router.push(`/dashboard/EmployeeManagement/edit?id=${encodeURIComponent(id)}`);
              } else {
                router.push("/dashboard");
              }
            }}
            disabled={isSubmitting || !!successMsg}
            className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || !!successMsg}
            className="bg-[#f08a4b] hover:bg-[#e07a3b] text-white px-8 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 shadow-md shadow-orange-100 flex items-center gap-2 min-w-[150px] justify-center"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </span>
            ) : (
              <>
                {id
                  ? (assignmentOption === "custom" ? "Create & Assign Role" : isEditingExistingRole ? "Apply Changes & Assign" : "Confirm Assignment")
                  : (assignmentOption === "custom" ? "Create Role" : "Save Changes")}
              </>
            )}
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Role"
        message={`Delete the role "${selectedRole?.role_name ?? ""}"? Any users currently assigned this role will be unassigned. This action cannot be undone.`}
        confirmText="Delete Role"
        cancelText="Cancel"
        onConfirm={confirmDeleteRole}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={isDeleting}
        type="danger"
      />
    </div>
  );
}

export default function AssignRolePage() {
  return (
    <React.Suspense fallback={
      <div className="max-w-[1000px] mx-auto pb-20 pt-2 space-y-6" aria-hidden="true">
        <div className="skeleton-shimmer h-8 w-64 rounded-lg" />
        <div className="skeleton-shimmer h-40 rounded-2xl" />
        <div className="skeleton-shimmer h-64 rounded-2xl" />
      </div>
    }>
      <AssignRoleContent />
    </React.Suspense>
  );
}
