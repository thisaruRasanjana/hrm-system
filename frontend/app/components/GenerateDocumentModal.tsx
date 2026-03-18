"use client";

import { useEffect, useState } from "react";
import { X, FileText, Send, RefreshCw, Eye, EyeOff } from "lucide-react";

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

export default function GenerateDocumentModal({ request, onClose, onSuccess }: Props) {
  const [templates, setTemplates] = useState<TemplateType[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const [previewMode, setPreviewMode] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://localhost:8000/document-templates/")
      .then((res) => res.json())
      .then((data) => {
        const htmlTemplates = data.filter((t: any) => t.template_type === "HTML");
        setTemplates(htmlTemplates);
        if (htmlTemplates.length > 0) {
          setSelectedTemplate(htmlTemplates[0].id.toString());
        }
      })
      .catch((err) => console.error("Failed to load templates", err))
      .finally(() => setLoadingTemplates(false));
  }, []);

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
      if (!res.ok) throw new Error(data.error || "Preview failed");

      setPreviewHtml(data.preview_html);
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
      if (!res.ok) throw new Error(data.error || "Generation failed");

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
          
          {/* Top Info Row */}
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

          {/* Template Selector (styled as the wide template display box from mockup) */}
          <div className="relative z-10 w-full mb-2">
            {!loadingTemplates && templates.length > 0 && (
              <select
                value={selectedTemplate}
                onChange={(e) => {
                  setSelectedTemplate(e.target.value);
                  setPreviewMode(false);
                }}
                className="w-full border border-gray-100 bg-white rounded-[16px] px-6 py-5 text-[15px] font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F2924E]/50 focus:border-[#F2924E]/50 transition appearance-none cursor-pointer shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)]"
              >
                <option value="" disabled>Select a Template...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            {templates.length === 0 && !loadingTemplates && (
               <p className="text-[13px] text-red-500 font-medium p-3 bg-red-50 rounded-lg border border-red-100">No HTML templates available for auto-generation.</p>
            )}
          </div>

          {/* Document Preview Box Container */}
          {!previewMode ? (
            <div className="border border-gray-100 bg-white rounded-[32px] p-12 flex flex-col items-center justify-center text-center relative overflow-hidden transition-all shadow-sm">
              <h3 className="font-bold text-gray-900 text-[16px] mb-2 tracking-tight">Auto-Generated Document</h3>
              <p className="text-[14px] text-gray-600 font-medium mb-10 tracking-wide">
                This document will be auto-filled by the system with complete details
              </p>
              
              <div className="px-8 py-3.5 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mb-8">
                <FileText size={24} className="text-gray-400" />
              </div>
              
              <button
                onClick={handleTogglePreview}
                disabled={loadingPreview || !selectedTemplate}
                className="text-[#F2924E] text-[15px] font-bold flex items-center gap-2 hover:opacity-80 transition disabled:opacity-50"
              >
                {loadingPreview ? <RefreshCw size={18} className="animate-spin" /> : <Eye size={18} />}
                Show Preview
              </button>
              
              <p className="text-[13px] text-gray-500 font-medium mt-8">
                Click "Show Preview" to see the generated document
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
                style={{ minHeight: "350px", padding: '24px' }}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
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
            disabled={loadingGenerate || !selectedTemplate}
            className="flex-1 py-4 bg-[#F2924E] hover:bg-[#e07d3a] text-white text-[14px] font-bold rounded-2xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 disabled:shadow-none"
          >
            {loadingGenerate ? (
              <>
                <RefreshCw size={18} className="animate-spin" /> Generating...
              </>
            ) : (
              <>
                <FileText size={18} /> Generate & Send
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
