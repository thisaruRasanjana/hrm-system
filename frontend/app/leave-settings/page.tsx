'use client';

import React, { useEffect, useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
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

const cellKey = (roleId: number, typeId: number) => `${roleId}:${typeId}`;

export default function LeaveSettingsPage() {
  const { loading: authLoading, hasPermission } = useAuth();
  const canManage = hasPermission('leave:type_manage');

  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  const load = async () => {
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

  useEffect(() => {
    if (canManage) load();
  }, [canManage]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => { setMessage(''); setMessageType(''); }, 4000);
    return () => clearTimeout(t);
  }, [message]);

  const handleSave = async () => {
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
      setMessage('Leave entitlements saved.');
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
        You don&apos;t have permission to manage leave entitlements.
      </div>
    );
  }

  return (
    <div>
      <LeaveTabs />

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Leave Entitlements</h1>
          <p className="mt-1 text-gray-500">
            Set the yearly leave allowance per role. Empty cells fall back to the
            leave type default; balances update immediately for everyone in that role.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            disabled={loading || saving}
            className="flex items-center gap-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={loading || saving}
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
    </div>
  );
}
