"use client";

import { useEffect, useState } from "react";
import DocumentTabs from "../../../components/DocumentTabsHR";
import {
  PlusCircle, Trash2, Pencil, Check, X, ToggleLeft, ToggleRight, FileType,
} from "lucide-react";

type DocType = {
  id: string;
  name: string;
  description: string | null;
  is_mandatory: boolean;
  is_active: boolean;
  created_at: string;
};

const API = "http://localhost:8000/api/document-types";

export default function DocumentTypesPage() {
  const [types, setTypes] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isMandatory, setIsMandatory] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editMandatory, setEditMandatory] = useState(false);
  const [editError, setEditError] = useState("");

  const fetchTypes = () => {
    setLoading(true);
    fetch(`${API}/`)
      .then((r) => r.json())
      .then((data) => setTypes(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTypes(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setCreateError("Name is required."); return; }
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch(`${API}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, is_mandatory: isMandatory }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create");
      }
      setName(""); setDescription(""); setIsMandatory(false);
      fetchTypes();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (type: DocType) => {
    await fetch(`${API}/${type.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !type.is_active }),
    });
    fetchTypes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document type? Existing uploads will not be affected.")) return;
    await fetch(`${API}/${id}`, { method: "DELETE" });
    fetchTypes();
  };

  const startEdit = (type: DocType) => {
    setEditId(type.id);
    setEditName(type.name);
    setEditDescription(type.description || "");
    setEditMandatory(type.is_mandatory);
    setEditError("");
  };

  const cancelEdit = () => { setEditId(null); setEditError(""); };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) { setEditError("Name is required."); return; }
    try {
      const res = await fetch(`${API}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() || null, is_mandatory: editMandatory }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to save");
      }
      setEditId(null);
      fetchTypes();
    } catch (err: any) {
      setEditError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <DocumentTabs />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Document Types</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create and manage document types that employees are required or allowed to upload.
        </p>
      </div>

      {/* Create Form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-5">
          <PlusCircle size={18} className="text-[#F2924E]" />
          Create New Document Type
        </h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. TIN Certificate"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2924E]/40 focus:border-[#F2924E]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2924E]/40 focus:border-[#F2924E]"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMandatory(!isMandatory)}
              className="focus:outline-none"
            >
              {isMandatory
                ? <ToggleRight size={32} className="text-[#F2924E]" />
                : <ToggleLeft size={32} className="text-gray-300" />}
            </button>
            <span className="text-sm font-medium text-gray-700">
              {isMandatory ? "Mandatory" : "Optional"}
            </span>
          </div>
          <div className="flex items-end justify-end gap-3">
            {createError && <p className="text-xs text-red-500">{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-2.5 bg-[#F2924E] hover:bg-[#e07d3a] text-white text-sm font-semibold rounded-xl transition shadow-sm disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create Document Type"}
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <FileType size={16} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">All Document Types</span>
          <span className="ml-auto text-xs text-gray-400">{types.length} types</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : types.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No document types created yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Description</th>
                <th className="px-6 py-3 text-center">Mandatory</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {types.map((type) => (
                <tr key={type.id} className="hover:bg-gray-50/50 transition">
                  {editId === type.id ? (
                    <>
                      <td className="px-6 py-3">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2924E]/40"
                        />
                        {editError && <p className="text-xs text-red-500 mt-1">{editError}</p>}
                      </td>
                      <td className="px-6 py-3">
                        <input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2924E]/40"
                        />
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button onClick={() => setEditMandatory(!editMandatory)} className="focus:outline-none">
                          {editMandatory
                            ? <ToggleRight size={24} className="text-[#F2924E]" />
                            : <ToggleLeft size={24} className="text-gray-300" />}
                        </button>
                      </td>
                      <td className="px-6 py-3 text-center">—</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => saveEdit(type.id)} className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition" title="Save">
                            <Check size={14} />
                          </button>
                          <button onClick={cancelEdit} className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition" title="Cancel">
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-3 font-semibold text-gray-800">{type.name}</td>
                      <td className="px-6 py-3 text-gray-500">{type.description || "—"}</td>
                      <td className="px-6 py-3 text-center">
                        {type.is_mandatory
                          ? <span className="px-2 py-0.5 bg-[#F2924E]/10 text-[#F2924E] text-xs font-bold rounded-full">Mandatory</span>
                          : <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-bold rounded-full">Optional</span>}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button onClick={() => toggleActive(type)} className="focus:outline-none" title={type.is_active ? "Deactivate" : "Activate"}>
                          {type.is_active
                            ? <ToggleRight size={24} className="text-[#F2924E]" />
                            : <ToggleLeft size={24} className="text-gray-300" />}
                        </button>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => startEdit(type)} className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(type.id)} className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
