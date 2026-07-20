import React, { useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddLeaveTypeModal({ onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultDays, setDefaultDays] = useState('');
  const [directlyRequestable, setDirectlyRequestable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('/leave/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          default_days: defaultDays.trim() ? Number(defaultDays) : null,
          directly_requestable: directlyRequestable,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to create leave type');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Add New Leave Type</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Leave Type Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Study Leave"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-[#EE7F22] focus:outline-none focus:ring-1 focus:ring-[#EE7F22] shadow-sm"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this leave type..."
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-[#EE7F22] focus:outline-none focus:ring-1 focus:ring-[#EE7F22] shadow-sm resize-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Default Leave Count (Days) <span className="text-gray-400 font-normal ml-1">(Optional)</span>
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={defaultDays}
                onChange={(e) => setDefaultDays(e.target.value)}
                placeholder="e.g. 15"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-[#EE7F22] focus:outline-none focus:ring-1 focus:ring-[#EE7F22] shadow-sm"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                This will be the default yearly allowance for all roles unless overridden in the matrix.
              </p>
            </div>

            <div className="flex items-start gap-3 mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <input
                type="checkbox"
                id="requestable"
                checked={directlyRequestable}
                onChange={(e) => setDirectlyRequestable(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#EE7F22] focus:ring-[#EE7F22]"
              />
              <label htmlFor="requestable" className="text-sm text-gray-700 cursor-pointer">
                <span className="font-semibold block mb-0.5 text-gray-900">Directly Requestable</span>
                If checked, employees can select this leave type directly when applying for leave. Uncheck for internal/HR-assigned leaves.
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[#EE7F22] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Leave Type'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
