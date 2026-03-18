"use client";

import { useState } from "react";
import RichTextEditor from "./RichTextEditor";
import { X, FileText, Upload } from "lucide-react";

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

const CATEGORIES = [
  "Service Letters",
  "Salary Letters",
  "Employment Confirmation",
  "Bank Letters",
  "HR Notices",
  "Other",
];

export default function TemplateAddModal({ onClose, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [templateType, setTemplateType] = useState<"HTML" | "FILE">("HTML");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim() || !category) {
      setError("Name and category are required.");
      return;
    }
    if (templateType === "HTML" && !content.trim()) {
      setError("Please enter HTML content for the template.");
      return;
    }
    if (templateType === "FILE" && !file) {
      setError("Please upload a file for the template.");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("name", name);
    formData.append("category", category);
    formData.append("template_type", templateType);
    if (templateType === "HTML") formData.append("content", content);
    if (templateType === "FILE" && file) formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/document-templates/", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to create template");

      onSuccess();
      onClose();
    } catch (err) {
      setError("Failed to create template. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-[640px] max-h-[90vh] rounded-2xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-[#F2924E]/10 p-2 rounded-lg">
              <FileText size={18} className="text-[#F2924E]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Add New Template</h2>
              <p className="text-xs text-gray-500">Create a reusable document template</p>
            </div>
          </div>
          <button
            onClick={onClose}
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
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Service Letter Template"
              className="w-full border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#F2924E] focus:border-[#F2924E]"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#F2924E]"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Template Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template Type <span className="text-red-500">*</span>
            </label>
            <div className="inline-flex bg-gray-100 rounded-lg p-1">
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
              />
            </div>
          )}

          {/* File Upload */}
          {templateType === "FILE" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload File
              </label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl py-8 cursor-pointer hover:border-[#F2924E] transition">
                <Upload size={28} className="text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">
                  {file ? file.name : "Click to upload DOCX or PDF"}
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
        <div className="border-t px-6 py-4 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm rounded-lg border hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 text-sm rounded-lg bg-[#F2924E] text-white hover:bg-[#e07d3a] transition disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
