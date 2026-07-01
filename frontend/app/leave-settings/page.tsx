'use client';

import React, { useEffect, useState } from 'react';
import { Save, RotateCcw, Search } from 'lucide-react';
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
};

type EmployeeEntitlementEntry = {
  leave_type_id: number;
  leave_type_name: string;
  days: number | null;
  is_override: boolean;
};

type EmployeeEntitlementsResponse = {
  employee_id: number;
  employee_name: string;
  leave_types: LeaveTypeInfo[];
  entries: EmployeeEntitlementEntry[];
};

const cellKey = (roleId: number, typeId: number) => `${roleId}:${typeId}`;
const empCellKey = (typeId: number) => `emp:${typeId}`;

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
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [empData, setEmpData] = useState<EmployeeEntitlementsResponse | null>(null);
  const [empDraft, setEmpDraft] = useState<Record<string, string>>({});
  
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
      const d: Record<string, string> = {};
      for (const e of data.entries) {
        d[empCellKey(e.leave_type_id)] = e.days === null ? '' : String(e.days);
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
        const raw = (empDraft[empCellKey(t.id)] ?? '').trim();
        return {
          leave_type_id: t.id,
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
      const d: Record<string, string> = {};
      for (const e of data.entries) {
        d[empCellKey(e.leave_type_id)] = e.days === null ? '' : String(e.days);
      }
      setEmpDraft(d);
      setMessage('Employee leave entitlements saved.');
      setMessageType('success');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save entitlements.');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return null;

  if (!canManage) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 text-sm">
        You don't have permission to manage leave entitlements.
      </div>
    );
  }

  const filteredEmployees = employees.filter(e => 
    `${e.first_name} ${e.last_name} ${e.employee_id}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <LeaveTabs />

      <div className="mt-4 mb-6">
        <div className="flex space-x-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('role')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'role'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Role Entitlements
          </button>
          <button
            onClick={() => setActiveTab('employee')}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'employee'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Employee Entitlements
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {activeTab === 'role' ? 'Role Leave Entitlements' : 'Employee Leave Entitlements'}
          </h1>
          <p className="mt-1 text-gray-500">
            {activeTab === 'role' 
              ? 'Set the yearly leave allowance per role. Empty cells fall back to the leave type default.'
              : 'Set specific leave allowances for individual employees. These override both role and default settings.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={activeTab === 'role' ? loadRoleEntitlements : () => selectedEmployeeId && loadEmployeeEntitlements(selectedEmployeeId)}
            disabled={loading || saving || (activeTab === 'employee' && !selectedEmployeeId)}
            className="flex items-center gap-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            onClick={activeTab === 'role' ? handleSaveRole : handleSaveEmployee}
            disabled={loading || saving || (activeTab === 'employee' && !selectedEmployeeId)}
            className="flex items-center gap-1.5 bg-[#F2924E] hover:bg-orange-500 text-white text-sm font-medium px-5 py-2 rounded-lg transition disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            messageType === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message}
        </div>
      )}

      {activeTab === 'role' && (
        <>
          {loading ? (
            <div className="mt-6 rounded-2xl bg-white p-6 text-gray-500 shadow-sm">
              Loading entitlements…
            </div>
          ) : matrix && (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Role</th>
                    {matrix.leave_types.map((t) => (
                      <th key={t.id} className="px-6 py-4 text-center text-sm font-medium text-gray-500">
                        {t.name}
                        <span className="block text-[11px] font-normal text-gray-400">
                          default {t.default_days ?? '—'} days
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.roles.map((role) => (
                    <tr key={role.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">{role.name}</td>
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
                              className={`w-24 rounded-lg border px-3 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 ${
                                entry?.is_override
                                  ? 'border-orange-300 bg-orange-50 text-gray-900'
                                  : 'border-gray-200 text-gray-700'
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
            Highlighted cells are role-specific overrides. Clearing a cell removes the
            override so that role uses the leave type default again.
          </p>
        </>
      )}

      {activeTab === 'employee' && (
        <div className="mt-6 flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3 bg-white border border-gray-200 rounded-2xl shadow-sm p-4 flex flex-col">
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>
            <div className="flex-1 overflow-y-auto max-h-96 space-y-1">
              {filteredEmployees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmployeeId(emp.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                    selectedEmployeeId === emp.id 
                      ? 'bg-orange-50 text-orange-900 font-medium border border-orange-200' 
                      : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{emp.first_name} {emp.last_name}</span>
                    <span className="text-xs text-gray-400">{emp.employee_id}</span>
                  </div>
                </button>
              ))}
              {filteredEmployees.length === 0 && (
                <div className="text-center py-4 text-sm text-gray-500">No employees found.</div>
              )}
            </div>
          </div>

          <div className="w-full md:w-2/3">
            {!selectedEmployeeId ? (
              <div className="h-full min-h-[300px] flex items-center justify-center bg-gray-50 border border-gray-200 rounded-2xl border-dashed">
                <p className="text-gray-500 text-sm">Select an employee to view and edit their leave entitlements.</p>
              </div>
            ) : loading ? (
              <div className="h-full min-h-[300px] flex items-center justify-center bg-white border border-gray-200 rounded-2xl shadow-sm">
                <p className="text-gray-500 text-sm">Loading employee entitlements...</p>
              </div>
            ) : empData ? (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">{empData.employee_name}</h3>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Type</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Default / Role Days</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Employee Override</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empData.leave_types.map((t) => {
                      const key = empCellKey(t.id);
                      const entry = empData.entries.find((e) => e.leave_type_id === t.id);
                      return (
                        <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-800">{t.name}</td>
                          <td className="px-6 py-4 text-sm text-center text-gray-500">
                            {t.default_days ?? '∞'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              value={empDraft[key] ?? ''}
                              onChange={(e) => setEmpDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                              placeholder="No override"
                              className={`w-28 rounded-lg border px-3 py-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 ${
                                entry?.is_override
                                  ? 'border-orange-300 bg-orange-50 text-gray-900'
                                  : 'border-gray-200 text-gray-700'
                              }`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Highlighted inputs indicate a direct override for this employee. Emptying the input removes the override.
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
