'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Save, RotateCcw, Search, ChevronDown, Users, SlidersHorizontal } from 'lucide-react';
import LeaveTabs from '@/components/LeaveTabs';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth-context';

type Role = { id: number; name: string };
type LeaveTypeInfo = { id: number; name: string; default_days: number | null };
type Entry = {
  role_id: number;
  role_name: string;
  leave_type_id: number;
  leave_type_name: string;
  days: number | null;
  is_override: boolean;
};
type Matrix = { roles: Role[]; leave_types: LeaveTypeInfo[]; entries: Entry[] };

type EmployeePanelOption = {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  department_name: string | null;
  designation: string | null;
  has_leave_override?: boolean;
};

type EmployeeEntitlementEntry = {
  leave_type_id: number;
  leave_type_name: string;
  days: number | null;
  is_override: boolean;
  mode?: string;
  days_per_month?: number | null;
  total_leaves_cap?: number | null;
  carry_forward_allowed?: boolean;
  period_start?: string | null;
  period_end?: string | null;
};

type EmployeeEntitlementsResponse = {
  employee_id: number;
  employee_name: string;
  leave_types: LeaveTypeInfo[];
  entries: EmployeeEntitlementEntry[];
};

const cellKey = (roleId: number, typeId: number) => `${roleId}:${typeId}`;
const empCellKey = (typeId: number) => `emp:${typeId}`;

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

const AVATAR_COLORS = [
  'bg-orange-100 text-orange-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
];

function getAvatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

export default function LeaveSettingsPage() {
  const { loading: authLoading, hasPermission } = useAuth();
  const canManage = hasPermission('leave:type_manage');

  const [activeTab, setActiveTab] = useState<'role' | 'employee'>('role');

  // Role Tab State
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  
  // Employee Tab State
  const [employees, setEmployees] = useState<EmployeePanelOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'az' | 'za' | 'custom'>('az');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [empData, setEmpData] = useState<EmployeeEntitlementsResponse | null>(null);
  const [empDraft, setEmpDraft] = useState<Record<string, { days?: string; daysPerMonth?: string; carryForwardAllowed?: boolean }>>({});
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  const loadRoleEntitlements = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/leave/entitlements');
      if (!res.ok) throw new Error('Failed to load entitlements');
      const data: Matrix = await res.json();
      setMatrix(data);
      const d: Record<string, string> = {};
      for (const e of data.entries) {
        d[cellKey(e.role_id, e.leave_type_id)] = e.days === null ? '' : String(e.days);
      }
      setDraft(d);
    } catch (err) {
      console.error(err);
      setMessage('Failed to load leave entitlements.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const res = await apiFetch('/employees/panel-options');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (err) {
      console.error('Failed to load employees', err);
    }
  };

  const loadEmployeeEntitlements = async (empId: number) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/leave/entitlements/employee/${empId}`);
      if (!res.ok) throw new Error('Failed to load employee entitlements');
      const data: EmployeeEntitlementsResponse = await res.json();
      setEmpData(data);
      const d: Record<string, any> = {};
      for (const e of data.entries) {
        if (e.mode === 'accrual') {
          d[empCellKey(e.leave_type_id)] = {
            daysPerMonth: e.days_per_month === null ? '' : String(e.days_per_month),
            carryForwardAllowed: !!e.carry_forward_allowed
          };
        } else {
          d[empCellKey(e.leave_type_id)] = { days: e.days === null ? '' : String(e.days) };
        }
      }
      setEmpDraft(d);
    } catch (err) {
      console.error(err);
      setMessage('Failed to load employee leave entitlements.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) {
      loadRoleEntitlements();
      loadEmployees();
    }
  }, [canManage]);

  useEffect(() => {
    if (activeTab === 'employee' && selectedEmployeeId) {
      loadEmployeeEntitlements(selectedEmployeeId);
    }
  }, [selectedEmployeeId, activeTab]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => { setMessage(''); setMessageType(''); }, 4000);
    return () => clearTimeout(t);
  }, [message]);

  const handleSaveRole = async () => {
    if (!matrix) return;
    setSaving(true);
    try {
      const items = matrix.entries.map((e) => {
        const raw = (draft[cellKey(e.role_id, e.leave_type_id)] ?? '').trim();
        return {
          role_id: e.role_id,
          leave_type_id: e.leave_type_id,
          days: raw === '' ? null : Number(raw),
        };
      });

      const invalid = items.find((i) => i.days !== null && (Number.isNaN(i.days) || i.days < 0));
      if (invalid) {
        setMessage('Entitlements must be empty or a number of days (0 or more).');
        setMessageType('error');
        setSaving(false);
        return;
      }

      const res = await apiFetch('/leave/entitlements', {
        method: 'PUT',
        body: JSON.stringify(items),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || 'Failed to save entitlements');
      }
      const data: Matrix = await res.json();
      setMatrix(data);
      const d: Record<string, string> = {};
      for (const e of data.entries) {
        d[cellKey(e.role_id, e.leave_type_id)] = e.days === null ? '' : String(e.days);
      }
      setDraft(d);
      setMessage('Role leave entitlements saved.');
      setMessageType('success');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save entitlements.');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmployee = async () => {
    if (!empData || !selectedEmployeeId) return;
    setSaving(true);
    try {
      const items = empData.leave_types.map((t) => {
        const entry = empData.entries.find((e) => e.leave_type_id === t.id);
        const draftObj = empDraft[empCellKey(t.id)] || {};
        
        if (entry?.mode === 'accrual') {
          const rawVal = draftObj.daysPerMonth?.trim() || '';
          // Auto-compute total cap from period dates × days_per_month
          let computedCap: number | null = null;
          if (rawVal !== '' && entry?.period_start && entry?.period_end) {
            const start = new Date(entry.period_start);
            const end = new Date(entry.period_end);
            const months = Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
            computedCap = Number(rawVal) * months;
          }
          return {
            leave_type_id: t.id,
            days_per_month: rawVal === '' ? null : Number(rawVal),
            total_leaves_cap: computedCap,
            carry_forward_allowed: !!draftObj.carryForwardAllowed
          };
        } else {
          const rawVal = draftObj.days?.trim() || '';
          return {
            leave_type_id: t.id,
            days: rawVal === '' ? null : Number(rawVal),
          };
        }
      });

      const invalid = items.find((i) => {
        if ('days_per_month' in i) {
          return i.days_per_month != null && (Number.isNaN(i.days_per_month) || i.days_per_month < 0);
        }
        return i.days !== null && (Number.isNaN(i.days) || i.days < 0);
      });
      if (invalid) {
        setMessage('Entitlements must be empty or a number of days (0 or more).');
        setMessageType('error');
        setSaving(false);
        return;
      }

      const res = await apiFetch(`/leave/entitlements/employee/${selectedEmployeeId}`, {
        method: 'PUT',
        body: JSON.stringify(items),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || 'Failed to save employee entitlements');
      }
      const data: EmployeeEntitlementsResponse = await res.json();
      setEmpData(data);
      const d: Record<string, any> = {};
      for (const e of data.entries) {
        if (e.mode === 'accrual') {
          d[empCellKey(e.leave_type_id)] = {
            daysPerMonth: e.days_per_month === null ? '' : String(e.days_per_month),
            carryForwardAllowed: !!e.carry_forward_allowed
          };
        } else {
          d[empCellKey(e.leave_type_id)] = { days: e.days === null ? '' : String(e.days) };
        }
      }
      setEmpDraft(d);

      const stillHasOverride = data.entries.some((e) => e.is_override);
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === selectedEmployeeId ? { ...emp, has_leave_override: stillHasOverride } : emp
        )
      );

      setMessage('Employee leave entitlements saved.');
      setMessageType('success');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save entitlements.');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetRole = () => {
    if (!matrix) return;
    const d: Record<string, string> = {};
    for (const e of matrix.entries) {
      d[cellKey(e.role_id, e.leave_type_id)] = e.days === null ? '' : String(e.days);
    }
    setDraft(d);
  };

  const handleResetEmployee = () => {
    if (!empData) return;
    const d: Record<string, any> = {};
    for (const e of empData.entries) {
      if (e.mode === 'accrual') {
        d[empCellKey(e.leave_type_id)] = {
          daysPerMonth: e.days_per_month === null ? '' : String(e.days_per_month),
          totalLeavesCap: e.total_leaves_cap != null ? String(e.total_leaves_cap) : '',
          carryForwardAllowed: !!e.carry_forward_allowed
        };
      } else {
        d[empCellKey(e.leave_type_id)] = { days: e.days === null ? '' : String(e.days) };
      }
    }
    setEmpDraft(d);
  };

  const hasUnsavedChanges = (empId: number) => {
    if (empId !== selectedEmployeeId || !empData) return false;
    for (const e of empData.entries) {
      const draftObj = empDraft[empCellKey(e.leave_type_id)] || {};
      if (e.mode === 'accrual') {
         const draftVal = (draftObj.daysPerMonth ?? '').trim();
         const savedVal = e.days_per_month == null ? '' : String(e.days_per_month);
         if (draftVal !== savedVal || !!draftObj.carryForwardAllowed !== !!e.carry_forward_allowed) return true;
      } else {
         const draftVal = (draftObj.days ?? '').trim();
         const savedVal = e.days === null ? '' : String(e.days);
         if (draftVal !== savedVal) return true;
      }
    }
    return false;
  };

  // Unique department list for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => { if (e.department_name) set.add(e.department_name); });
    return Array.from(set).sort();
  }, [employees]);

  // Filtered + sorted employees
  const filteredEmployees = useMemo(() => {
    let list = employees.filter(e => {
      const matchesSearch = `${e.first_name} ${e.last_name} ${e.employee_id ?? ''}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesDept = deptFilter === 'all' || e.department_name === deptFilter;
      return matchesSearch && matchesDept;
    });

    if (sortMode === 'az') {
      list = [...list].sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      );
    } else if (sortMode === 'za') {
      list = [...list].sort((a, b) =>
        `${b.first_name} ${b.last_name}`.localeCompare(`${a.first_name} ${a.last_name}`)
      );
    } else if (sortMode === 'custom') {
      list = [...list].sort((a, b) =>
        (b.has_leave_override ? 1 : 0) - (a.has_leave_override ? 1 : 0)
      );
    }

    return list;
  }, [employees, searchQuery, deptFilter, sortMode]);

  if (authLoading) return null;

  if (!canManage) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 text-sm">
        You don't have permission to manage leave entitlements.
      </div>
    );
  }

  return (
    <div>
      <LeaveTabs />

      {/* Sub-tabs */}
      <div className="mt-4 mb-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
          {(['role', 'employee'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-white text-[#EE7F22] shadow-sm border border-orange-100'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'role' ? 'Role Entitlements' : 'Employee Entitlements'}
            </button>
          ))}
        </div>
      </div>

      {/* Header row */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {activeTab === 'role' ? 'Role Leave Entitlements' : 'Employee Leave Entitlements'}
          </h1>
          <p className="mt-1 text-gray-500 text-sm">
            {activeTab === 'role'
              ? 'Set the yearly leave allowance per role. Empty cells fall back to the leave type default.'
              : 'Set specific leave allowances for individual employees. These override both role and default settings.'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={activeTab === 'role' ? handleResetRole : handleResetEmployee}
            disabled={loading || saving || (activeTab === 'employee' && !selectedEmployeeId)}
            className="flex items-center gap-1.5 border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-sm font-medium px-4 py-2.5 rounded-xl transition shadow-sm disabled:opacity-40"
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            onClick={activeTab === 'role' ? handleSaveRole : handleSaveEmployee}
            disabled={loading || saving || (activeTab === 'employee' && !selectedEmployeeId)}
            className="flex items-center gap-1.5 bg-[#EE7F22] hover:bg-orange-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-sm shadow-orange-200 disabled:opacity-40"
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mb-5 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
            messageType === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {messageType === 'success' ? '✓' : '✕'} {message}
        </div>
      )}

      {/* ── Role Tab ── */}
      {activeTab === 'role' && (
        <>
          {loading ? (
            <div className="mt-6 rounded-2xl bg-white p-8 text-gray-400 shadow-sm border border-gray-100 text-center text-sm">
              Loading entitlements…
            </div>
          ) : matrix && (
            <div className="mt-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Role</th>
                    {matrix.leave_types.map((t) => (
                      <th key={t.id} className="px-6 py-4 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        {t.name}
                        <span className="block text-[10px] font-normal text-gray-400 normal-case mt-0.5">
                          default: {t.default_days ?? '∞'} days
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.roles.map((role, i) => (
                    <tr key={role.id} className={`border-t border-gray-50 hover:bg-gray-50/60 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">{role.name}</td>
                      {matrix.leave_types.map((t) => {
                        const key = cellKey(role.id, t.id);
                        const entry = matrix.entries.find(
                          (e) => e.role_id === role.id && e.leave_type_id === t.id
                        );
                        return (
                          <td key={t.id} className="px-6 py-3 text-center">
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              value={draft[key] ?? ''}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              placeholder={t.default_days !== null ? String(t.default_days) : '∞'}
                              className={`w-24 rounded-lg border px-3 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 transition-colors ${
                                entry?.is_override
                                  ? 'border-[#EE7F22]/40 bg-orange-50 text-gray-900 font-medium'
                                  : 'border-gray-200 text-gray-700 bg-white'
                              }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-gray-400">
            Highlighted cells are role-specific overrides. Clearing a cell removes the override so that role uses the leave type default again.
          </p>
        </>
      )}

      {/* ── Employee Tab ── */}
      {activeTab === 'employee' && (
        <div className="flex flex-col md:flex-row gap-5">

          {/* Left: Employee List */}
          <div className="w-full md:w-[300px] lg:w-[320px] flex-shrink-0 flex flex-col gap-3">

            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search name or ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] shadow-sm transition"
              />
            </div>

            {/* Filter + Sort row */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] shadow-sm cursor-pointer transition"
                >
                  <option value="all">All Departments</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
                  className="appearance-none pl-3 pr-7 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] shadow-sm cursor-pointer transition"
                >
                  <option value="az">A → Z</option>
                  <option value="za">Z → A</option>
                  <option value="custom">Custom First</option>
                </select>
                <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Stats line */}
            <div className="flex items-center gap-2 px-1">
              <Users size={13} className="text-gray-400" />
              <span className="text-xs text-gray-400">
                {filteredEmployees.length} of {employees.length} employees
                {filteredEmployees.filter(e => e.has_leave_override).length > 0 && (
                  <span className="ml-1.5 text-[#EE7F22] font-medium">
                    · {filteredEmployees.filter(e => e.has_leave_override).length} with custom settings
                  </span>
                )}
              </span>
            </div>

            {/* Employee Cards */}
            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[520px] pr-0.5">
              {filteredEmployees.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400 bg-white border border-gray-100 rounded-2xl shadow-sm">
                  <Users size={28} className="mx-auto mb-2 text-gray-200" />
                  No employees found
                </div>
              ) : (
                filteredEmployees.map(emp => {
                  const isSelected = selectedEmployeeId === emp.id;
                  const isModified = hasUnsavedChanges(emp.id);
                  return (
                    <button
                      key={emp.id}
                      onClick={() => setSelectedEmployeeId(emp.id)}
                      className={`w-full text-left px-3.5 py-3 rounded-xl transition-all duration-150 border group ${
                        isSelected
                          ? 'bg-[#FFF6EE] border-[#EE7F22]/30 shadow-sm'
                          : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${getAvatarColor(emp.id)}`}>
                          {getInitials(emp.first_name, emp.last_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[13px] font-semibold truncate ${isSelected ? 'text-[#EE7F22]' : 'text-gray-800'}`}>
                              {emp.first_name} {emp.last_name}
                            </span>
                            {isModified && (
                              <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200 animate-pulse uppercase tracking-wide">
                                Unsaved
                              </span>
                            )}
                            {emp.has_leave_override && !isModified && (
                              <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200 uppercase tracking-wide">
                                Custom
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-gray-400 font-mono">{emp.employee_id}</span>
                            {emp.department_name && (
                              <>
                                <span className="text-gray-200">·</span>
                                <span className="text-[11px] text-gray-400 truncate">{emp.department_name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className={`transition-transform duration-150 flex-shrink-0 ${isSelected ? 'text-[#EE7F22] translate-x-0.5' : 'text-gray-200 group-hover:translate-x-0.5 group-hover:text-gray-400'}`}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Entitlement Editor */}
          <div className="flex-1 min-w-0">
            {!selectedEmployeeId ? (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white border-2 border-dashed border-gray-200 rounded-2xl gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <SlidersHorizontal size={24} className="text-gray-300" />
                </div>
                <div className="text-center">
                  <p className="text-gray-600 text-sm font-medium">Select an employee</p>
                  <p className="text-gray-400 text-xs mt-0.5">Choose from the list to view and edit their leave settings</p>
                </div>
              </div>
            ) : loading ? (
              <div className="h-full min-h-[400px] flex items-center justify-center bg-white border border-gray-100 rounded-2xl shadow-sm">
                <div className="text-center">
                  <div className="w-6 h-6 border-2 border-[#EE7F22] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Loading entitlements…</p>
                </div>
              </div>
            ) : empData ? (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                {/* Employee header */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-transparent flex items-center gap-4">
                  {(() => {
                    const emp = employees.find(e => e.id === selectedEmployeeId);
                    if (!emp) return null;
                    return (
                      <>
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${getAvatarColor(emp.id)}`}>
                          {getInitials(emp.first_name, emp.last_name)}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-[15px]">{empData.employee_name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            {emp.designation && <span className="text-xs text-gray-500">{emp.designation}</span>}
                            {emp.department_name && emp.designation && <span className="text-gray-300 text-xs">·</span>}
                            {emp.department_name && <span className="text-xs text-gray-500">{emp.department_name}</span>}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Leave table */}
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="px-6 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Leave Type</th>
                      <th className="px-6 py-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">Default / Role Days</th>
                      <th className="px-6 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Employee Override</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empData.leave_types.map((t) => {
                      const key = empCellKey(t.id);
                      const entry = empData.entries.find((e) => e.leave_type_id === t.id);
                      return (
                        <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm font-semibold text-gray-800">{t.name}</td>
                          <td className="px-6 py-4 text-sm text-center text-gray-500 tabular-nums">
                            {t.default_days ?? '∞'} days
                          </td>
                          <td className="px-6 py-4 text-right">
                            {entry?.mode === 'accrual' ? (
                              <div className="flex flex-col items-end w-full max-w-[280px] ml-auto border border-orange-200 rounded-xl bg-white overflow-hidden shadow-sm">
                                <div className="bg-orange-50 px-3 py-2 w-full border-b border-orange-100 flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wide">Monthly Accrual</span>
                                  <label className="flex items-center gap-1.5 text-[11px] text-gray-700 font-medium cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={empDraft[key]?.carryForwardAllowed || false}
                                      onChange={(e) => setEmpDraft((prev) => ({ ...prev, [key]: { ...prev[key], carryForwardAllowed: e.target.checked } }))}
                                      className="w-3.5 h-3.5 text-[#EE7F22] rounded border-gray-300 focus:ring-[#EE7F22]"
                                    />
                                    Carry Forward
                                  </label>
                                </div>
                                
                                <div className="p-3 w-full flex flex-col gap-3">
                                  {/* Days per month editable */}
                                  <div className="flex justify-between items-center">
                                    <span className="text-[12px] text-gray-500 font-medium">Earning Rate:</span>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        min={0}
                                        step={0.5}
                                        value={empDraft[key]?.daysPerMonth ?? ''}
                                        onChange={(e) => setEmpDraft((prev) => ({ ...prev, [key]: { ...prev[key], daysPerMonth: e.target.value } }))}
                                        placeholder="0.0"
                                        title="Days per month"
                                        className="w-16 rounded-lg border border-[#EE7F22]/40 bg-orange-50/50 px-2 py-1.5 text-center text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] transition-colors"
                                      />
                                      <span className="text-[11px] text-gray-400 font-medium">days/mo</span>
                                    </div>
                                  </div>

                                  {/* Auto-computed total (read-only) */}
                                  {(() => {
                                    const dpm = empDraft[key]?.daysPerMonth;
                                    if (!dpm || !entry?.period_start || !entry?.period_end) return null;
                                    const start = new Date(entry.period_start!);
                                    const end = new Date(entry.period_end!);
                                    const months = Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
                                    const total = (Number(dpm) * months).toFixed(1);
                                    return (
                                      <div className="flex justify-between items-center bg-gray-50 rounded-lg px-2.5 py-2 border border-gray-100">
                                        <span className="text-[11px] text-gray-500 font-medium">Est. Total:</span>
                                        <div className="text-right">
                                          <span className="text-sm font-bold text-gray-800">{total} <span className="text-xs font-medium text-gray-400">days</span></span>
                                          <span className="text-[10px] text-gray-400 block mt-0.5">for {months} months</span>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            ) : (
                                <input
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  value={empDraft[key]?.days ?? ''}
                                  onChange={(e) => setEmpDraft((prev) => ({ ...prev, [key]: { days: e.target.value } }))}
                                  placeholder="No override"
                                className={`w-32 rounded-xl border px-3 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] transition-colors ${
                                  entry?.is_override
                                    ? 'border-[#EE7F22]/40 bg-orange-50 text-gray-900 font-semibold'
                                    : 'border-gray-200 text-gray-600 bg-white'
                              }`}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center gap-2">
                  <div className="w-3 h-3 rounded border border-[#EE7F22]/40 bg-orange-50 flex-shrink-0" />
                  <p className="text-xs text-gray-400">
                    Highlighted inputs are active overrides for this employee. Clear the field to remove the override.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
