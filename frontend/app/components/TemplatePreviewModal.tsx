"use client";

import { useEffect, useState } from "react";
import { X, FileText, RefreshCw } from "lucide-react";
import { apiFetch, fileUrl } from "@/lib/api";
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
};

export default function TemplatePreviewModal({ template, onClose }: Props) {
  const { closing, triggerClose } = useCloseAnimation(onClose);
  // Backend returns file_path as a ready URL (local: /uploads/..., S3: presigned).
  // fileUrl() resolves it to an absolute, fetchable URL for both backends.
  const previewUrl = template.file_path ? fileUrl(template.file_path) : null;

  const [docxPreview, setDocxPreview] = useState<string | null>(null);
  const [loadingDocx, setLoadingDocx] = useState(false);
  const [docxError, setDocxError] = useState(false);

  useEffect(() => {
    if (template.template_type === "DOCX" && template.file_path) {
      setLoadingDocx(true);
      apiFetch(`/document-templates/${template.id}/preview`)
        .then((res) => {
          if (!res.ok) throw new Error("Preview fetch failed");
          return res.json();
        })
        .then((data) => {
          setDocxPreview(data.preview_html);
        })
        .catch(() => setDocxError(true))
        .finally(() => setLoadingDocx(false));
    }
  }, [template]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm ${closing ? "animate-backdrop-out" : "animate-backdrop"}`}
      onClick={triggerClose}
    >
      <div
        className={`bg-white w-[800px] max-h-[90vh] rounded-2xl shadow-2xl flex flex-col ${closing ? "animate-modal-out" : "animate-modal"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
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
            onClick={triggerClose}
            className="text-gray-400 hover:text-gray-700 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Preview Body */}
        <div className="flex-1 overflow-hidden p-6 bg-white">
          <div className="border border-gray-100 rounded-2xl overflow-y-auto h-[560px] bg-gray-50/50 relative shadow-inner">
            {template.template_type === "HTML" && template.content ? (
              // HTML Preview — render HTML content in a sandboxed iframe
              <iframe
                srcDoc={`<!DOCTYPE html><html><head><style>
                  body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.7; color: #333; }
                  h1, h2, h3 { color: #1a1a1a; }
                  p { margin-bottom: 12px; }
                  .placeholder { background: #fff3e0; padding: 2px 6px; border-radius: 4px; color: #e65100; font-style: italic; }
                </style></head><body>${template.content}</body></html>`}
                className="w-full h-full border-0 absolute inset-0"
                sandbox="allow-same-origin"
                title="Template Preview"
              />
            ) : previewUrl ? (
              // File Preview
              template.template_type === "PDF" || template.file_path?.endsWith(".pdf") ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0 absolute inset-0"
                  title="Template File Preview"
                />
              ) : template.template_type === "DOCX" ? (
                loadingDocx ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4">
                    <RefreshCw size={32} className="text-[#F2924E] animate-spin" />
                    <p className="text-gray-500 text-sm">Generating Preview...</p>
                  </div>
                ) : docxError ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4">
                    <FileText size={48} className="text-gray-300" />
                    <p className="text-red-500 text-sm">Preview could not be generated.</p>
                    <a
                      href={previewUrl}
                      download
                      className="px-5 py-2 bg-[#F2924E] text-white text-sm rounded-lg hover:bg-[#e07d3a] transition mt-2"
                    >
                      Download to View
                    </a>
                  </div>
                ) : docxPreview ? (
                  <iframe
                    srcDoc={`<!DOCTYPE html><html><head><style>
                      body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.7; color: #333; }
                      h1, h2, h3 { color: #1a1a1a; }
                      p { margin-bottom: 10px; }
                      table { border-collapse: collapse; width: 100%; margin-bottom: 15px; }
                      td, th { border: 1px solid #ddd; padding: 8px; }
                    </style></head><body>${docxPreview}</body></html>`}
                    className="w-full h-full border-0 absolute inset-0 bg-white"
                    sandbox="allow-same-origin"
                    title="DOCX Template Preview"
                  />
                ) : null
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <FileText size={48} className="text-gray-300" />
                  <p className="text-gray-500 text-sm">File cannot be previewed.</p>
                  <a
                    href={previewUrl}
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
        <div className="border-t border-gray-100 px-6 py-4 flex justify-end bg-gray-50/50">
          <button
            onClick={triggerClose}
            className="px-6 py-2.5 text-sm rounded-xl bg-[#F2924E] text-white hover:bg-[#e07d3a] transition font-bold shadow-md hover:shadow-lg"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
