"use client";

import { useEffect, useState } from "react";
import { Plus, Eye, Pencil, Trash2, FileText, LayoutTemplate } from "lucide-react";
import DocumentTabsHR from "../../components/DocumentTabsHR";
import TemplateAddModal from "../../components/TemplateAddModal";
import TemplateEditModal from "../../components/TemplateEditModal";
import TemplatePreviewModal from "../../components/TemplatePreviewModal";

type Template = {
  id: number;
  name: string;
  category: string;
  template_type: string;
  content: string | null;
  file_path: string | null;
  created_at: string;
};

export default function TemplatesManagementPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const employeeDbId =
    typeof window !== "undefined"
      ? (localStorage.getItem("employeeDbId") ?? "8")
      : "8";

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/document-templates/", {
        headers: { "X-Employee-ID": employeeDbId },
      });
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch templates", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      await fetch(`http://localhost:8000/document-templates/${deleteId}`, {
        method: "DELETE",
        headers: { "X-Employee-ID": employeeDbId },
      });
      setDeleteId(null);
      fetchTemplates();
    } catch (err) {
      console.error("Delete failed", err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <DocumentTabsHR />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Template Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage document templates used for generating employee letters.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-[#F2924E] hover:bg-[#e07d3a] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition shadow-sm"
        >
          <Plus size={16} />
          Add Template
        </button>
      </div>

      {/* Stat Card */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-6 flex justify-between items-center">
        <div>
          <p className="text-xs text-gray-400">TOTAL TEMPLATES</p>
          <h2 className="text-3xl font-semibold">{templates.length}</h2>
          <p className="text-xs text-gray-400">
            templates available for document generation
          </p>
        </div>
        <div className="text-[#F2924E]">
          <LayoutTemplate size={36} />
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-16 text-center text-gray-400">
          <LayoutTemplate size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-16 text-center text-gray-400">
          <LayoutTemplate size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-medium text-gray-500">No templates yet</p>
          <p className="text-sm mt-1">Click "Add Template" to create your first one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white border border-gray-100 shadow-sm rounded-xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
            >
              {/* Card Top — icon, name/category, actions all inline */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#F2924E]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-[#F2924E]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm leading-snug truncate">
                    {tpl.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{tpl.category}</p>
                </div>
                {/* Inline actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setPreviewTemplate(tpl)}
                    className="p-1.5 rounded-lg border border-gray-100 text-gray-500 hover:bg-gray-50 transition"
                    title="Preview"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => setEditTemplate(tpl)}
                    className="p-1.5 rounded-lg border border-[#F2924E]/30 text-[#F2924E] hover:bg-[#F2924E]/5 transition"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteId(tpl.id)}
                    className="p-1.5 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Preview snippet for HTML templates */}
              {tpl.template_type === "HTML" && tpl.content && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-400 line-clamp-3 leading-relaxed border border-gray-100">
                  {tpl.content.replace(/<[^>]+>/g, " ").trim().slice(0, 120)}...
                </div>
              )}

              {/* File indicator */}
              {tpl.template_type !== "HTML" && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-400 border border-gray-100 flex items-center gap-2">
                  <FileText size={12} />
                  {tpl.file_path?.split("/").pop() ?? "Uploaded file"}
                </div>
              )}

              {/* Date */}
              <p className="text-xs text-gray-300">
                Created{" "}
                {new Date(tpl.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <TemplateAddModal
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchTemplates}
        />
      )}

      {/* Edit Modal */}
      {editTemplate && (
        <TemplateEditModal
          template={editTemplate}
          onClose={() => setEditTemplate(null)}
          onSuccess={fetchTemplates}
        />
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setDeleteId(null)}
        >
          <div
            className="bg-white w-[420px] rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2.5 rounded-xl">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Delete Template</h3>
                <p className="text-xs text-gray-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 bg-red-50 border border-red-100 rounded-lg p-3 mb-5">
              Are you sure you want to delete this template? Any requests using
              this template will no longer have a reference.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}