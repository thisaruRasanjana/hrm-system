"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Department {
  id: number;
  name: string;
}

type Props = {
  value: number | null;
  onChange: (id: number) => void;
  /** Tailwind classes for the <select>, so it matches the surrounding form. */
  selectClass?: string;
};

/**
 * Department picker with inline "add new department".
 *
 * Departments are not hardcoded — the list comes from the API. If none exist
 * yet, the user is prompted to add one. The "+ Add new department" control is
 * always available; a created department is persisted, then auto-selected.
 */
export default function DepartmentSelect({ value, onChange, selectClass }: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Department[]>("/departments/")
      .then((data) => setDepartments(data))
      .catch((err) => console.error("Failed to load departments", err))
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
      setError("Enter a department name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await api.post<Department>("/departments/", { name });
      setDepartments((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      onChange(created.id); // auto-select the new department
      setAdding(false);
      setNewName("");
    } catch (err: any) {
      setError(err?.message || "Failed to add department.");
    } finally {
      setSaving(false);
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

  if (adding) {
    return (
      <div>
        <div className="flex gap-2 mt-1.5">
          <input
            type="text"
            autoFocus
            value={newName}
            placeholder="New department name"
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
            ? "Loading departments..."
            : departments.length === 0
              ? "No departments yet — add one below"
              : "Select Department"}
        </option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={startAdding}
        className="mt-2 text-[#EE7F22] hover:text-[#d66f1b] text-[13px] font-medium transition-colors"
      >
        + Add new department
      </button>
    </div>
  );
}
