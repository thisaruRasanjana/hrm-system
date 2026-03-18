"use client";

import { X, FileText } from "lucide-react";

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
};

export default function TemplatePreviewModal({ template, onClose }: Props) {
  const fileUrl = template.file_path
    ? `http://localhost:8000/${template.file_path}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-[800px] max-h-[90vh] rounded-2xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-[#F2924E]/10 p-2 rounded-lg">
              <FileText size={18} className="text-[#F2924E]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                {template.name}
              </h2>
              <p className="text-xs text-gray-500">
                {template.category} &bull;{" "}
                <span className="uppercase font-medium">{template.template_type}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Preview Body */}
        <div className="flex-1 overflow-hidden p-6">
          <div className="border rounded-xl overflow-hidden h-[560px] bg-gray-50">
            {template.template_type === "HTML" && template.content ? (
              // HTML Preview — render HTML content in a sandboxed iframe
              <iframe
                srcDoc={`<!DOCTYPE html><html><head><style>
                  body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.7; color: #333; }
                  h1, h2, h3 { color: #1a1a1a; }
                  p { margin-bottom: 12px; }
                  .placeholder { background: #fff3e0; padding: 2px 6px; border-radius: 4px; color: #e65100; font-style: italic; }
                </style></head><body>${template.content}</body></html>`}
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
                title="Template Preview"
              />
            ) : fileUrl ? (
              // File Preview — iframe for PDF, fallback message for DOCX
              template.file_path?.endsWith(".pdf") ? (
                <iframe
                  src={fileUrl}
                  className="w-full h-full border-0"
                  title="Template File Preview"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <FileText size={48} className="text-gray-300" />
                  <p className="text-gray-500 text-sm">
                    DOCX files cannot be previewed in browser.
                  </p>
                  <a
                    href={fileUrl}
                    download
                    className="px-5 py-2 bg-[#F2924E] text-white text-sm rounded-lg hover:bg-[#e07d3a] transition"
                  >
                    Download to View
                  </a>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No preview available.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm rounded-lg bg-[#F2924E] text-white hover:bg-[#e07d3a] transition"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
