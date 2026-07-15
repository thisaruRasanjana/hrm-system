"use client";

import { useState, useEffect } from "react";
import RichTextEditor from "./RichTextEditor";
import { X, FileText, Upload } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useCloseAnimation } from "@/app/hooks/useCloseAnimation";

type Template = {
  id: number;
  name: string;
  category: string;
  template_type: string;
  content: string | null;
  file_path: string | null;
  created_at: string;
};

type Props = {
  template: Template;
  onClose: () => void;
  onSuccess: () => void;
};

// Internal (non employee-requestable) template categories — e.g. the promotion
// flow, which matches its template by name/category containing "promotion".
const INTERNAL_TEMPLATE_CATEGORIES = ["Promotion Letter"];

export default function TemplateEditModal({ template, onClose, onSuccess }: Props) {
  const { closing, triggerClose } = useCloseAnimation(onClose);
  const [name, setName] = useState(template.name);
  const [category, setCategory] = useState(template.category);
  // DOCX/PDF templates are file-backed → map them to the "FILE" tab so the
  // upload field actually renders (only "HTML" and "FILE" are valid tab values).
  const [templateType, setTemplateType] = useState<"HTML" | "FILE">(
    template.template_type === "HTML" ? "HTML" : "FILE"
  );
  const [content, setContent] = useState(template.content || "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  // Categories mirror the requestable document types so templates stay matchable
  // to requests. Always include the template's current category so it stays
  // selectable even if it isn't a request type (e.g. the promotion letter).
  useEffect(() => {
    apiFetch("/api/document-types/active/?category=REQUEST")
      .then((res) => res.json())
      .then((data) =>
        setCategories(Array.isArray(data) ? data.map((t: { name: string }) => t.name) : [])
      )
      .catch((err) => console.error("Failed to load document types", err));
  }, []);

  const categoryOptions = Array.from(
    new Set([template.category, ...categories, ...INTERNAL_TEMPLATE_CATEGORIES].filter(Boolean))
  ) as string[];

  const handleSubmit = async () => {
    if (!name.trim() || !category) {
      setError("Name and category are required.");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    if (name) formData.append("name", name);
    if (category) formData.append("category", category);
    if (templateType === "HTML") {
      formData.append("template_type", "HTML");
      if (content) formData.append("content", content);
    } else if (file) {
      // File-based template: only send a file when the user actually picks a new
      // one. The backend auto-detects the real type (DOCX/PDF) from the file, so
      // we must NOT send template_type="FILE" (that would corrupt the type).
      formData.append("file", file);
    }

    try {
      const res = await apiFetch(`/document-templates/${template.id}`, {
        method: "PUT",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to update template");

      onSuccess();
      onClose();
    } catch (err) {
      setError("Failed to update template. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm ${closing ? "animate-backdrop-out" : "animate-backdrop"}`}
      onClick={triggerClose}
    >
      <div
        className={`bg-white w-[640px] max-h-[90vh] rounded-2xl shadow-2xl flex flex-col ${closing ? "animate-modal-out" : "animate-modal"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="bg-[#F2924E]/10 p-2 rounded-lg">
              <FileText size={18} className="text-[#F2924E]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Edit Template</h2>
              <p className="text-xs text-gray-500">Update the template details</p>
            </div>
          </div>
          <button
            onClick={triggerClose}
            className="text-gray-400 hover:text-gray-700 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">

          {/* Template Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Service Letter Template"
              className="w-full border border-gray-100 bg-gray-50/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#F2924E]/20 transition shadow-sm"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-100 bg-gray-50/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#F2924E]/20 transition shadow-sm"
            >
              <option value="">Select a category</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>


          {/* Template Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template Type
            </label>
            <div className="inline-flex bg-gray-100/50 border border-gray-100 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setTemplateType("HTML")}
                className={`px-5 py-2 text-sm rounded-md font-medium transition ${templateType === "HTML"
                    ? "bg-[#F2924E] text-white shadow"
                    : "text-gray-600 hover:text-gray-800"
                  }`}
              >
                Type content
              </button>
              <button
                type="button"
                onClick={() => setTemplateType("FILE")}
                className={`px-5 py-2 text-sm rounded-md font-medium transition ${templateType === "FILE"
                    ? "bg-[#F2924E] text-white shadow"
                    : "text-gray-600 hover:text-gray-800"
                  }`}
              >
                File Upload (DOCX / PDF)
              </button>
            </div>
          </div>

          {/* HTML Content */}
          {templateType === "HTML" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Content
              </label>
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholders={
                  category === "Promotion Letter" 
                    ? ["[Promotion Date]", "[Employee Name]", "[Employee ID]", "[Department]", "[New Designation]", "[Previous Designation]", "[Time Period in Previous Designation]", "[Effective Date]", "[Authorized Signatory Name]", "[Designation]"]
                    : undefined
                }
              />
            </div>
          )}

          {/* File Upload */}
          {templateType === "FILE" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Replace File (optional)
              </label>
              {template.file_path && !file && (
                <p className="text-xs text-gray-500 mb-2">
                  Current file:{" "}
                  <span className="font-medium text-gray-700">
                    {template.file_path.split("/").pop()}
                  </span>
                </p>
              )}
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-xl py-8 cursor-pointer hover:border-[#F2924E]/50 hover:bg-gray-50 transition shadow-sm">
                <Upload size={28} className="text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">
                  {file ? file.name : "Click to upload a new file"}
                </span>
                <span className="text-xs text-gray-400 mt-1">
                  Supported: .docx, .pdf
                </span>
                <input
                  type="file"
                  accept=".docx,.pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 flex gap-3 justify-end bg-gray-50/50">
          <button
            onClick={triggerClose}
            className="px-5 py-2.5 text-sm rounded-xl border border-gray-100 hover:bg-gray-50 text-gray-600 font-bold transition-all duration-300 shadow-sm bg-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 text-sm rounded-xl bg-[#F2924E] text-white hover:bg-[#e07d3a] transition disabled:opacity-60 font-bold shadow-md hover:shadow-lg"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
