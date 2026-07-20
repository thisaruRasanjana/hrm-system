'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Paperclip, ExternalLink, Check, X, Stethoscope } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { API_BASE_URL } from '@/lib/constants';

interface Conversion {
  id: number;
  leave_request_id: number;
  employee_id: number;
  employee_name?: string | null;
  start_date: string;
  end_date: string;
  attachment_urls?: string[] | null;
  reason?: string | null;
  status: string;
}

function fmt(d: string) {
  if (!d) return '--';
  const norm = /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d;
  const dt = new Date(norm);
  return Number.isNaN(dt.getTime())
    ? '--'
    : dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export default function PendingConversions() {
  const [items, setItems] = useState<Conversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [message, setMessage] = useState('');

  // `silent` background refreshes don't toggle the spinner or wipe the list on a
  // transient error — used by the auto-refresh poll so the UI doesn't flicker.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch('/leave/medical-conversions/pending', {
        method: 'GET',
        cache: 'no-store',
      });
      const data = res.ok ? await res.json() : [];
      setItems(Array.isArray(data) ? data : []);
    } catch {
      if (!silent) setItems([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh: poll every 15s and whenever the tab regains focus, so new
    // reclassification requests appear without a manual reload.
    const interval = setInterval(() => load(true), 15000);
    const onFocus = () => load(true);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const act = async (id: number, action: 'approve' | 'reject') => {
    setBusyId(id);
    setMessage('');
    try {
      const res = await apiFetch(`/leave/medical-conversions/${id}/${action}`, {
        method: 'PATCH',
        body: JSON.stringify({ reviewer_comment: comments[id] || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to ${action}`);
      }
      setMessage(
        action === 'approve'
          ? 'Reclassification approved — the days are now Medical leave.'
          : 'Reclassification rejected.'
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : `Failed to ${action}`);
    } finally {
      setBusyId(null);
    }
  };

  // Hide the whole section when there is nothing pending.
  if (!loading && items.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2">
        <Stethoscope size={20} className="text-[#F2924E]" />
        <h2 className="text-[20px] font-bold text-[#1F2937]">Medical Reclassification Requests</h2>
        <span className="ml-1 rounded-full bg-[#FFF2E3] px-3 py-0.5 text-[13px] font-semibold text-[#F2924E]">
          {items.length}
        </span>
      </div>
      <p className="mt-1 text-[14px] text-[#667085]">
        An employee asked to reclassify part of an approved Casual leave as Medical. Approving moves
        those days to their Medical balance.
      </p>

      {message && (
        <div className="mt-3 rounded-[12px] border border-[#E4E7EC] bg-[#F9FAFB] px-4 py-2 text-[14px] text-[#344054]">
          {message}
        </div>
      )}

      {loading ? (
        <div className="mt-4 rounded-[14px] bg-white p-6 text-[15px] text-[#667085] shadow-sm">
          Loading…
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((c) => (
            <div key={c.id} className="rounded-[16px] border border-[#E4E7EC] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[16px] font-semibold text-[#1F2937]">
                  {c.employee_name || `Employee ${c.employee_id}`}
                </p>
                <span className="text-[13px] text-[#98A2B3]">LR-{c.leave_request_id}</span>
              </div>
              <p className="mt-1 text-[14px] text-[#475467]">
                Reclassify <span className="font-medium">{fmt(c.start_date)} – {fmt(c.end_date)}</span> to Medical
              </p>
              {c.reason && (
                <p className="mt-1 text-[13px] text-[#667085]">Reason: {c.reason}</p>
              )}

              {Array.isArray(c.attachment_urls) && c.attachment_urls.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {c.attachment_urls.map((url, i) => {
                    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : '';
                    const full = (url.startsWith('http') ? url : `${API_BASE_URL}${url}`) + (token ? `?token=${token}` : '');
                    const name = url.split('/').pop() || `file-${i + 1}`;
                    return (
                      <a
                        key={i}
                        href={full}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[13px] text-[#F2924E] hover:underline"
                      >
                        <Paperclip size={13} /> {name} <ExternalLink size={12} />
                      </a>
                    );
                  })}
                </div>
              )}

              <input
                type="text"
                value={comments[c.id] || ''}
                onChange={(e) => setComments((p) => ({ ...p, [c.id]: e.target.value }))}
                placeholder="Comment (optional)"
                disabled={busyId === c.id}
                className="mt-3 w-full rounded-[10px] border border-[#D0D5DD] bg-[#F9FAFB] px-3 py-2 text-[14px] text-[#344054] placeholder:text-[#98A2B3] focus:outline-none disabled:opacity-70"
              />

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => act(c.id, 'approve')}
                  disabled={busyId === c.id}
                  className="flex h-[42px] items-center justify-center gap-1.5 rounded-[10px] bg-[#F2924E] text-[14px] font-medium text-white disabled:opacity-60"
                >
                  <Check size={16} /> {busyId === c.id ? '…' : 'Approve'}
                </button>
                <button
                  onClick={() => act(c.id, 'reject')}
                  disabled={busyId === c.id}
                  className="flex h-[42px] items-center justify-center gap-1.5 rounded-[10px] bg-[#98A2B3] text-[14px] font-medium text-white disabled:opacity-60"
                >
                  <X size={16} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
