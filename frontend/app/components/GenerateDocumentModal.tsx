"use client";

import { useEffect, useState } from "react";
import { X, FileText, Send, RefreshCw, Eye, EyeOff, FileCode, Info } from "lucide-react";

type Props = {
  request: any;
  onClose: () => void;
  onSuccess: () => void;
};

type TemplateType = {
  id: number;
  name: string;
  template_type: string;
};

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  HTML:  { label: "HTML",  color: "bg-blue-100 text-blue-600" },
  DOCX:  { label: "DOCX",  color: "bg-green-100 text-green-700" },
  PDF:   { label: "PDF",   color: "bg-red-100 text-red-600" },
};

export default function GenerateDocumentModal({ request, onClose, onSuccess }: Props) {
  const [templates, setTemplates] = useState<TemplateType[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const [previewMode, setPreviewMode] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [error, setError] = useState("");

  // Derive selected template object
  const selectedTemplateObj = templates.find(t => t.id.toString() === selectedTemplate);
  const selectedType = selectedTemplateObj?.template_type?.toUpperCase() ?? "";

  const canPreview = selectedType === "HTML" || selectedType === "DOCX";
  const isPdf = selectedType === "PDF";

  useEffect(() => {
    fetch("http://localhost:8000/document-templates/")
      .then((res) => res.json())
      .then((data) => {
        // Show ALL templates — HTML, DOCX, PDF
        setTemplates(data);
        if (data.length > 0) {
          setSelectedTemplate(data[0].id.toString());
        }
      })
      .catch((err) => console.error("Failed to load templates", err))
      .finally(() => setLoadingTemplates(false));
  }, []);

  // Reset preview when template changes
  const handleTemplateChange = (val: string) => {
    setSelectedTemplate(val);
    setPreviewMode(false);
    setPreviewHtml("");
    setError("");
  };

  const handleTogglePreview = async () => {
    if (previewMode) {
      setPreviewMode(false);
      return;
    }

    if (!selectedTemplate) {
      setError("Please select a template first");
      return;
    }

    setLoadingPreview(true);
    setError("");

    try {
      const res = await fetch(`http://localhost:8000/hr-document-requests/${request.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: parseInt(selectedTemplate),
          preview: true,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!res.ok) throw new Error("Preview failed");

      setPreviewHtml(data.preview_html || "");
      setPreviewMode(true);
    } catch (err: any) {
      setError(err.message || "Failed to fetch preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleGenerateAndSend = async () => {
    if (!selectedTemplate) {
      setError("Please select a template");
      return;
    }

    if (isPdf) {
      setError("PDF templates do not support variable filling. Please use an HTML or DOCX template.");
      return;
    }

    setLoadingGenerate(true);
    setError("");

    try {
      const res = await fetch(`http://localhost:8000/hr-document-requests/${request.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: parseInt(selectedTemplate),
          preview: false,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!res.ok) throw new Error("Generation failed");

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to generate document");
    } finally {
      setLoadingGenerate(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        className={`bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
          previewMode ? "w-[900px] max-h-[90vh]" : "w-[680px] max-h-[90vh]"
        }`}
      >
        {/* Header */}
        <div className="px-8 py-6 flex items-start justify-between border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#F2924E] rounded-2xl flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-gray-900 mb-0.5">Generate Document</h2>
              <p className="text-[13px] text-gray-500 font-medium tracking-tight">Auto-generated document with employee details</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col gap-8">

          {/* Requester info row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">REQUESTER</p>
              <p className="text-[14px] font-bold text-gray-900 leading-none mb-1">{request.employee_name}</p>
              <p className="text-[12px] text-gray-500 font-medium">{request.employee_id}</p>
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">DELIVERY METHOD</p>
              <p className="text-[14px] font-bold text-gray-900 leading-none">Email</p>
            </div>
            <div className="flex-[1.5]">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">PURPOSE</p>
              <p className="text-[14px] font-bold text-gray-900 leading-snug line-clamp-2">{request.purpose}</p>
            </div>
          </div>

          {/* Template Selector */}
          <div className="relative z-10 w-full">
            {loadingTemplates ? (
              <div className="w-full border border-gray-100 bg-gray-50 rounded-[16px] px-6 py-5 text-sm text-gray-400 animate-pulse">
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <p className="text-[13px] text-red-500 font-medium p-3 bg-red-50 rounded-lg border border-red-100">
                No templates available. Please add templates first.
              </p>
            ) : (
              <div className="relative">
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full border border-gray-100 bg-white rounded-[16px] px-6 py-5 text-[15px] font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F2924E]/50 focus:border-[#F2924E]/50 transition appearance-none cursor-pointer shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)]"
                >
                  {templates.map(t => {
                    const badge = TYPE_BADGES[t.template_type?.toUpperCase()] ?? { label: t.template_type, color: "" };
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name}  [{badge.label}]
                      </option>
                    );
                  })}
                </select>
                {/* Type badge shown below the select */}
                {selectedTemplateObj && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${TYPE_BADGES[selectedType]?.color ?? "bg-gray-100 text-gray-600"}`}>
                      {selectedType}
                    </span>
                    <span className="text-[12px] text-gray-400">template selected</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PDF warning */}
          {isPdf && (
            <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <Info size={18} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-[13px] text-red-700 font-medium">
                PDF templates do not support variable filling. Please use an <strong>HTML</strong> or <strong>DOCX</strong> template to auto-fill employee details.
              </p>
            </div>
          )}

          {/* DOCX info note */}
          {selectedType === "DOCX" && !isPdf && (
            <div className="flex gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <Info size={18} className="text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] text-green-800 font-bold mb-1">DOCX Template</p>
                <p className="text-[12px] text-green-700">
                  Variables like <code className="bg-green-100 px-1 rounded">{"{{employee_name}}"}</code>, <code className="bg-green-100 px-1 rounded">{"{{date}}"}</code>, <code className="bg-green-100 px-1 rounded">{"{{purpose}}"}</code> will be replaced with real data.
                  Click <strong>Show Preview</strong> to see the generated document with the variables filled.
                </p>
              </div>
            </div>
          )}

          {/* Document Preview Box — only for HTML */}
          {!isPdf && (
            !previewMode ? (
              <div className="border border-gray-100 bg-white rounded-[32px] p-12 flex flex-col items-center justify-center text-center relative overflow-hidden transition-all shadow-sm">
                <h3 className="font-bold text-gray-900 text-[16px] mb-2 tracking-tight">Auto-Generated Document</h3>
                <p className="text-[14px] text-gray-600 font-medium mb-10 tracking-wide">
                  {selectedType === "DOCX"
                    ? "This DOCX template will be filled with employee details when you generate."
                    : "This document will be auto-filled by the system with complete details"}
                </p>

                <div className="px-8 py-3.5 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mb-8">
                  {selectedType === "DOCX"
                    ? <FileCode size={24} className="text-green-500" />
                    : <FileText size={24} className="text-gray-400" />
                  }
                </div>

                {canPreview && (
                  <button
                    onClick={handleTogglePreview}
                    disabled={loadingPreview || !selectedTemplate}
                    className="text-[#F2924E] text-[15px] font-bold flex items-center gap-2 hover:opacity-80 transition disabled:opacity-50"
                  >
                    {loadingPreview ? <RefreshCw size={18} className="animate-spin" /> : <Eye size={18} />}
                    Show Preview
                  </button>
                )}

                <p className="text-[13px] text-gray-500 font-medium mt-8">
                  {canPreview
                    ? "Click \"Show Preview\" to see the generated document"
                    : "Click \"Generate & Send\" to produce the filled DOCX file"}
                </p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col h-full text-left">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                  <h3 className="font-bold text-gray-900 text-[15px] flex items-center gap-2">
                    <FileText size={18} className="text-[#F2924E]" />
                    Document Preview
                  </h3>
                  <button
                    onClick={handleTogglePreview}
                    className="text-gray-500 hover:text-gray-800 text-[13px] font-bold flex items-center gap-1.5 hover:bg-gray-100 border border-gray-200 px-4 py-2 rounded-xl transition shadow-sm"
                  >
                    <EyeOff size={16} /> Hide Preview
                  </button>
                </div>
                <div
                  className="flex-1 w-full overflow-y-auto text-left prose prose-sm max-w-none bg-gray-50/50 rounded-xl"
                  style={{ minHeight: "350px", padding: "24px" }}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            )
          )}

          {error && (
            <p className="text-[13px] text-red-500 font-bold text-center bg-red-50 border border-red-100 rounded-lg p-3">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-gray-100 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[14px] font-bold rounded-2xl transition"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerateAndSend}
            disabled={loadingGenerate || !selectedTemplate || isPdf}
            className="flex-1 py-4 bg-[#F2924E] hover:bg-[#e07d3a] text-white text-[14px] font-bold rounded-2xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 disabled:shadow-none"
          >
            {loadingGenerate ? (
              <><RefreshCw size={18} className="animate-spin" /> Generating...</>
            ) : (
              <><Send size={18} /> Generate &amp; Send</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
