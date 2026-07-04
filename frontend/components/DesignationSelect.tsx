"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";

interface Designation {
  id: number;
  name: string;
}

type Props = {
  value: number | null;
  onChange: (id: number | null) => void;
  /** Tailwind classes for the <select>, so it matches the surrounding form. */
  selectClass?: string;
};

/**
 * Designation picker with inline "add new designation" and a manage/delete mode.
 *
 * Designations are not hardcoded — the list comes from the API. If none exist
 * yet, the user is prompted to add one. "+ Add new designation" is always
 * available; a created designation is persisted, then auto-selected. Designations
 * with no employees assigned can be deleted from "Manage".
 */
export default function DesignationSelect({ value, onChange, selectClass }: Props) {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [managing, setManaging] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [manageError, setManageError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Designation[]>("/designations/")
      .then((data) => setDesignations(data))
      .catch((err) => console.error("Failed to load designations", err))
      .finally(() => setLoading(false));
  }, []);

  const startAdding = () => {
    setAdding(true);
    setNewName("");
    setError(null);
  };

  const cancelAdding = () => {
    setAdding(false);
    setNewName("");
    setError(null);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setError("Enter a designation name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await api.post<Designation>("/designations/", { name });
      setDesignations((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      onChange(created.id); // auto-select the new designation
      setAdding(false);
      setNewName("");
    } catch (err: any) {
      setError(err?.message || "Failed to add designation.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dept: Designation) => {
    if (!confirm(`Delete the "${dept.name}" designation?`)) return;
    setDeletingId(dept.id);
    setManageError(null);
    try {
      await api.delete(`/designations/${dept.id}`);
      setDesignations((prev) => prev.filter((d) => d.id !== dept.id));
      if (value === dept.id) onChange(null); // clear selection if it was selected
    } catch (err: any) {
      setManageError(err?.message || "Failed to delete designation.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelAdding();
    }
  };

  // ── Add mode ───────────────────────────────────────────────────────────────
  if (adding) {
    return (
      <div>
        <div className="flex gap-2 mt-1.5">
          <input
            type="text"
            autoFocus
            value={newName}
            placeholder="New designation name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] transition-colors"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="px-4 py-2.5 rounded-lg bg-[#EE7F22] text-white text-[14px] font-medium hover:bg-[#d66f1b] transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {saving ? "Adding..." : "Add"}
          </button>
          <button
            type="button"
            onClick={cancelAdding}
            disabled={saving}
            className="px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-[14px] font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-red-500 text-[12px] mt-1.5">{error}</p>}
      </div>
    );
  }

  // ── Manage / delete mode ───────────────────────────────────────────────────
  if (managing) {
    return (
      <div className="mt-1.5 border border-gray-200 rounded-lg overflow-hidden">
        {designations.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-gray-400">No designations to manage.</p>
        ) : (
          designations.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-b-0">
              <span className="text-[14px] text-gray-800">{d.name}</span>
              <button
                type="button"
                onClick={() => handleDelete(d)}
                disabled={deletingId === d.id}
                className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                aria-label={`Delete ${d.name}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
        {manageError && <p className="text-red-500 text-[12px] px-4 py-2">{manageError}</p>}
        <div className="px-4 py-2 bg-gray-50">
          <button
            type="button"
            onClick={() => { setManaging(false); setManageError(null); }}
            className="text-[13px] font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── Normal select mode ─────────────────────────────────────────────────────
  return (
    <div>
      <select
        value={value || ""}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className={selectClass}
        disabled={loading}
      >
        <option value="" disabled>
          {loading
            ? "Loading designations..."
            : designations.length === 0
              ? "No designations yet — add one below"
              : "Select Designation"}
        </option>
        {designations.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <div className="mt-2 flex items-center gap-4">
        <button
          type="button"
          onClick={startAdding}
          className="text-[#EE7F22] hover:text-[#d66f1b] text-[13px] font-medium transition-colors"
        >
          + Add new designation
        </button>
        {designations.length > 0 && (
          <button
            type="button"
            onClick={() => setManaging(true)}
            className="text-gray-500 hover:text-gray-800 text-[13px] font-medium transition-colors"
          >
            Manage
          </button>
        )}
      </div>
    </div>
  );
}
