"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Shield, Plus, Pencil, Trash2, Check, Lock, AlertCircle, ChevronDown,
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

// Built-in roles seeded by the backend — these are protected and cannot be
// deleted. Kept in sync with SYSTEM_ROLE_NAMES in backend/app/roles/seed.py.
// (The backend enforces this too; this just hides the delete button.)
const SYSTEM_ROLE_NAMES = ["Super Admin", "HR", "Manager", "Employee"];

// Map a permission's `resource` field to a friendly category label + sort order.
// Resources come from backend/app/roles/seed.py (employee, role, document, …).
const RESOURCE_META: Record<string, { label: string; order: number }> = {
  employee:    { label: "Employee Management", order: 1 },
  role:        { label: "Roles & Permissions", order: 2 },
  recruitment: { label: "Recruitment",         order: 3 },
  document:    { label: "Document Management",  order: 4 },
  leave:       { label: "Leave Management",     order: 5 },
  dashboard:   { label: "Dashboard & Widgets",  order: 6 },
  messaging:   { label: "Messaging",            order: 7 },
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
/** Human-readable label for a permission (description), with the raw name as fallback. */
const prettyLabel = (perm: Permission) => perm.description || perm.permission_name;

function AssignRoleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const { hasPermission, hasAnyPermission, loading: authLoading } = useAuth();

  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    if (authLoading) return;
    // Assigning a role to a specific employee needs role:assign. Pure Role
    // Management (no employee context) is also valid for role:view / role:create,
    // matching how the sidebar gates the "Role Management" link.
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
  const selectedIsSystem = !!selectedRole && SYSTEM_ROLE_NAMES.includes(selectedRole.role_name);

  // When selected role changes, reset edit mode
  useEffect(() => {
    setIsEditingExistingRole(false);
    setSelectedPermissionIds([]);
  }, [selectedRoleId]);

  // Switching between "existing" and "custom" should start from a clean slate
  // so permission picks from one mode don't carry into the other.
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

      // In pure Role Management mode (no employee), selecting an existing role
      // without clicking "Edit Permissions" is a no-op — don't claim success.
      if (!id && assignmentOption === "existing" && !isEditingExistingRole) {
        setErrorMsg('Nothing to save. Click "Edit Permissions" to change this role, or pick "Create Custom Role".');
        setIsSubmitting(false);
        return;
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

        setSuccessMsg(`"${roleName}" permissions updated and assigned to ${employee?.first_name ?? "the employee"}.`);
        setTimeout(() => router.push("/dashboard/employees"), 2000);
      } else {
        // Pure Role Management mode — the role was created/updated above.
        // Refresh the list so the UI reflects the change, then reset the form.
        await refreshRoles();
        setSuccessMsg(`Role "${roleName}" successfully saved.`);
        setIsEditingExistingRole(false);
        if (assignmentOption === "custom") {
          setCustomRoleName("");
          setSelectedPermissionIds([]);
          setAssignmentOption("existing");
        }
        // Stay on the page; clear the banner so the buttons re-enable.
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (error: unknown) {
      let msg = "Failed to save role assignment.";
      if (error instanceof Error) {
        msg = error.message;
      } else if (typeof error === "string") {
        msg = error;
      } else {
        console.error("Unexpected error object:", error);
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
        className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
          checked ? "bg-[#F2924E]/5 border-[#F2924E]" : "bg-white border-gray-100 hover:border-gray-200"
        }`}
      >
        <span className="relative mt-0.5 flex-shrink-0 inline-flex">
          <input
            type="checkbox"
            className="peer appearance-none w-4 h-4 rounded border-2 border-gray-300 bg-white transition-colors cursor-pointer focus:outline-none checked:bg-[#F2924E] checked:border-[#F2924E]"
            checked={checked}
            onChange={() => handleTogglePermission(perm.id)}
          />
          <Check size={12} strokeWidth={3.5} className="pointer-events-none absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100" />
        </span>
        <div className="min-w-0">
          <p className={`text-sm font-medium leading-tight ${checked ? "text-gray-900" : "text-gray-600"}`}>
            {prettyLabel(perm)}
          </p>
          <p className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">{perm.permission_name}</p>
        </div>
      </label>
    );
  };

  const PermissionBullet = ({ perm }: { perm: Permission }) => (
    <div className="flex items-start gap-2.5">
      <div className="w-6 h-6 rounded-lg bg-[#F2924E]/10 flex items-center justify-center flex-shrink-0">
        <Check size={13} className="text-[#F2924E]" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-700 font-medium leading-tight">{prettyLabel(perm)}</p>
        <p className="text-[11px] text-gray-400 font-mono truncate">{perm.permission_name}</p>
      </div>
    </div>
  );

  const CategoryCard = ({
    categoryKey, perms, mode,
  }: { categoryKey: string; perms: Permission[]; mode: "edit" | "view" }) => (
    <div className="bg-gray-50/60 rounded-2xl p-5 border border-gray-100">
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F2924E]" />
        {categoryLabel(categoryKey)}
        <span className="ml-auto text-[10px] font-semibold text-gray-400 normal-case">{perms.length}</span>
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
      active ? "bg-[#F2924E] border-[#F2924E] text-white shadow-lg shadow-[#F2924E]/20 scale-110" :
      completed ? "bg-[#F2924E]/10 border-[#F2924E] text-[#F2924E]" :
      "bg-white border-gray-200 text-gray-400"
    }`}>
      {completed ? <Check size={16} strokeWidth={3} /> : num}
    </div>
  );

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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="skeleton-shimmer h-4 w-24 rounded mb-4" />
        <div className="skeleton-shimmer h-12 w-72 rounded-lg mb-8" />
        {[1, 2].map(n => (
          <div key={n} className="bg-gray-50/60 rounded-2xl p-5 mb-4">
            <div className="skeleton-shimmer h-3.5 w-28 rounded mb-4" />
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton-shimmer h-11 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-[1000px] mx-auto pb-20 pt-2 space-y-6">
      {/* Header */}
      <div>
        <Link
          href={id ? `/dashboard/EmployeeManagement/edit?id=${encodeURIComponent(id)}` : "/dashboard"}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-3 font-medium"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <Shield size={22} className="text-[#F2924E]" />
          {id ? "Assign Role & Permissions" : "Role Management"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {employee ? `Defining access for ${employee.first_name} ${employee.last_name}` : "Create and manage system roles and permissions"}
        </p>
        {employee?.role && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-[#F2924E]/10 border border-[#F2924E]/20 rounded-full text-[13px] text-[#c4691f] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F2924E]" />
            Current role: <strong>{employee.role.role_name}</strong>
          </div>
        )}
      </div>

      {/* Step bar (only when assigning to a specific employee) */}
      {id && (
        <div className="flex items-center gap-4 px-1">
          <div className="flex items-center gap-3">
            <StepCircle num={1} completed />
            <span className="text-sm font-medium text-gray-500">Employee Details</span>
          </div>
          <div className="w-16 h-[2px] bg-[#F2924E]" />
          <div className="flex items-center gap-3">
            <StepCircle num={2} active />
            <span className="text-sm font-bold text-gray-900">Assign Role &amp; Permissions</span>
          </div>
        </div>
      )}

      {/* Banners */}
      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-100 rounded-2xl text-green-700 text-sm font-medium flex items-center gap-3">
          <Check size={18} strokeWidth={2.5} />
          {successMsg}{id ? " Redirecting..." : ""}
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words flex items-start gap-3">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {employee && !employee.user_id && (
        <div className="p-5 bg-amber-50 border border-amber-100 rounded-2xl">
          <div className="flex gap-3 text-amber-800">
            <AlertCircle size={22} className="flex-shrink-0" />
            <div>
              <p className="text-[15px] font-bold">System User Account Required</p>
              <p className="text-sm mt-1 opacity-90">This employee does not have a linked system user account. Roles and permissions can only be assigned to employees with active system access.</p>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Option */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-5">
          <Shield size={18} className="text-[#F2924E]" />
          {id ? "Assignment Option" : "What do you want to do?"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className={`flex items-start gap-3 p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${assignmentOption === "existing" ? "border-[#F2924E] bg-[#F2924E]/5" : "border-gray-100 hover:border-gray-200"}`}>
            <input type="radio" name="assignmentOption" className="mt-1 appearance-none w-4 h-4 rounded-full border-2 border-gray-300 bg-white transition-colors cursor-pointer focus:outline-none checked:border-[#F2924E] checked:bg-[#F2924E] checked:shadow-[inset_0_0_0_2px_#ffffff]" checked={assignmentOption === "existing"} onChange={() => setAssignmentOption("existing")} />
            <div>
              <p className={`text-sm font-bold ${assignmentOption === "existing" ? "text-[#F2924E]" : "text-gray-800"}`}>Select Existing Role</p>
              <p className="text-xs text-gray-500 mt-1">View, edit or {id ? "assign" : "manage"} a predefined role and its permissions</p>
            </div>
          </label>
          <label className={`flex items-start gap-3 p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${assignmentOption === "custom" ? "border-[#F2924E] bg-[#F2924E]/5" : "border-gray-100 hover:border-gray-200"}`}>
            <input type="radio" name="assignmentOption" className="mt-1 appearance-none w-4 h-4 rounded-full border-2 border-gray-300 bg-white transition-colors cursor-pointer focus:outline-none checked:border-[#F2924E] checked:bg-[#F2924E] checked:shadow-[inset_0_0_0_2px_#ffffff]" checked={assignmentOption === "custom"} onChange={() => setAssignmentOption("custom")} />
            <div>
              <p className={`text-sm font-bold ${assignmentOption === "custom" ? "text-[#F2924E]" : "text-gray-800"}`}>Create Custom Role</p>
              <p className="text-xs text-gray-500 mt-1">Define a brand-new role with a specific set of permissions</p>
            </div>
          </label>
        </div>
      </div>

      {/* ── Existing role panel ─────────────────────────────────────────────── */}
      {assignmentOption === "existing" ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="mb-6">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Role</label>
            <div className="relative max-w-md">
              <select
                value={selectedRoleId || ""}
                onChange={(e) => setSelectedRoleId(parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#F2924E]/40 focus:border-[#F2924E] appearance-none cursor-pointer"
              >
                {roles.map(role => (
                  <option key={role.id} value={role.id}>{role.role_name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
            </div>
            {selectedRole?.description && <p className="text-[13px] text-gray-500 mt-2 italic">{selectedRole.description}</p>}

            {selectedRole && selectedIsSystem && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 font-medium">
                <Lock size={13} /> Built-in system role — protected from deletion
              </p>
            )}

            {!id && selectedRole && !selectedIsSystem && (
              <button
                type="button"
                onClick={openDeleteConfirm}
                disabled={isDeleting || isSubmitting || !!successMsg}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 size={15} />
                {isDeleting ? "Deleting..." : "Delete this role"}
              </button>
            )}
          </div>

          {selectedRole && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-gray-800">
                  {isEditingExistingRole ? `Editing "${selectedRole.role_name}" Permissions` : "Permission Summary"}
                </h3>
                {!isEditingExistingRole ? (
                  <button
                    type="button"
                    onClick={startEditingRole}
                    className="inline-flex items-center gap-1.5 text-[13px] text-[#F2924E] font-bold hover:underline"
                  >
                    <Pencil size={14} /> Edit Permissions
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingExistingRole(false)}
                    className="text-[13px] text-gray-400 font-bold hover:underline"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              {(!isEditingExistingRole && selectedRole.permissions.length === 0) ? (
                <p className="text-sm text-gray-400 bg-gray-50/60 border border-gray-100 rounded-2xl p-6 text-center">
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
                <p className="text-[13px] text-gray-400 mt-4 italic flex items-center gap-1.5">
                  <AlertCircle size={13} /> Changing permissions for this role affects ALL users assigned to it.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── Custom role panel ─────────────────────────────────────────────── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-5">
            <Plus size={18} className="text-[#F2924E]" /> Create New Role
          </h2>
          <div className="mb-6 max-w-md">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Role Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Finance Manager"
              value={customRoleName}
              onChange={(e) => setCustomRoleName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F2924E]/40 focus:border-[#F2924E]"
            />
          </div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Permissions <span className="text-gray-300 normal-case font-medium">({selectedPermissionIds.length} selected)</span>
          </label>
          <div className="space-y-4">
            {categorize(allPermissions).map(([key, perms]) => (
              <CategoryCard key={key} categoryKey={key} perms={perms} mode="edit" />
            ))}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isSubmitting || !!successMsg}
          className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSubmitting || !!successMsg}
          className="px-6 py-2.5 rounded-xl bg-[#F2924E] hover:bg-[#e07d3a] text-white font-semibold text-sm shadow-sm transition flex items-center gap-2 disabled:opacity-60"
        >
          {isSubmitting ? (
            <span>Saving...</span>
          ) : (
            <>
              <Check size={16} strokeWidth={3} />
              {id
                ? (assignmentOption === "custom" ? "Create & Assign Role" : isEditingExistingRole ? "Apply Changes & Assign" : "Confirm Assignment")
                : (assignmentOption === "custom" ? "Create Role" : "Save Changes")}
            </>
          )}
        </button>
      </div>

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
