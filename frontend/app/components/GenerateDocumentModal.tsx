"use client";

import { useEffect, useRef, useState } from "react";
import { X, FileText, Send, RefreshCw, Eye, EyeOff, FileCode, Info, PenLine, AlertCircle,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, AlignLeft, AlignCenter, AlignRight, List, ListOrdered } from "lucide-react";
import { apiFetch } from "@/lib/api";

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

  // Custom letter state
  const editorRef = useRef<HTMLDivElement>(null);
  const [loadingCustomSend, setLoadingCustomSend] = useState(false);

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

  /* ──────────────────────────────────────────────────────
   *  Logic: detect if there is no matching template for
   *  this request's document type (or if request is "Other")
   * ────────────────────────────────────────────────────── */
  const hasNoTemplate = !loadingTemplates && templates.length === 0;

  useEffect(() => {
    // Fetch ONLY templates whose category matches this request's document_type
    const category = encodeURIComponent(request.document_type || "");
    apiFetch(`/document-templates/?category=${category}`)
      .then((res) => res.json())
      .then((data) => {
        setTemplates(data);
        if (data.length > 0) {
          setSelectedTemplate(data[0].id.toString());
        }
      })
      .catch((err) => console.error("Failed to load templates", err))
      .finally(() => setLoadingTemplates(false));
  }, [request.document_type]);

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
      const res = await apiFetch(`/hr-document-requests/${request.id}/generate`, {
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
      const res = await apiFetch(`/hr-document-requests/${request.id}/generate`, {
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

  const handleSendCustomLetter = async () => {
    const content = editorRef.current?.innerHTML?.trim() ?? "";
    if (!content || content === "<br>") {
      setError("Please write the letter content before sending.");
      return;
    }
    setLoadingCustomSend(true);
    setError("");
    try {
      const res = await apiFetch(`/hr-document-requests/${request.id}/custom-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to send custom letter");
    } finally {
      setLoadingCustomSend(false);
    }
  };

  const execFormat = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  /* ──────────────────────────────────────────────────────
   *  Render: Custom Letter Mode (no templates exist)
   * ────────────────────────────────────────────────────── */
  if (hasNoTemplate) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-backdrop">
        <div className="bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col w-[680px] max-h-[90vh] animate-modal">
          {/* Header */}
          <div className="px-8 py-6 flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#F2924E] rounded-2xl flex items-center justify-center text-white shadow-sm flex-shrink-0">
                <PenLine size={22} />
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-gray-900 mb-0.5">Write Custom Letter</h2>
                <p className="text-[13px] text-gray-500 font-medium tracking-tight">
                  {request.document_type} for {request.employee_name || request.requester_email}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition">
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col gap-6">
            {/* No template warning */}
            <div className="flex gap-3 bg-[#F2924E]/5 border border-[#F2924E]/20 rounded-xl p-4">
              <AlertCircle size={18} className="text-[#F2924E] shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-bold text-gray-900 mb-0.5">No Template Available</p>
                <p className="text-[12px] text-gray-600">
                  There is no template for &quot;{request.document_type}&quot; in the system. Please write a custom letter below. A starter template has been provided to help you get started.
                </p>
              </div>
            </div>

            {/* Requester info row */}
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">REQUESTER</p>
                <p className="text-[14px] font-bold text-gray-900 leading-none mb-1">{request.employee_name || request.requester_email || "External"}</p>
                <p className="text-[12px] text-gray-500 font-medium">{request.employee_id || "—"}</p>
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">DELIVERY METHOD</p>
                <p className="text-[14px] font-bold text-gray-900 leading-none">Email</p>
              </div>
              <div className="flex-[1.5]">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">PURPOSE</p>
                <p className="text-[14px] font-bold text-gray-900 leading-snug line-clamp-2">{request.reason}</p>
              </div>
            </div>

            {/* Rich text toolbar + editor */}
            <div>
              <p className="text-[13px] font-bold text-gray-900 mb-3">Letter Content</p>
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b-0 border-gray-100 rounded-t-2xl bg-gray-50/50">
                {([
                  ["bold",        <Bold size={14} />],
                  ["italic",      <Italic size={14} />],
                  ["underline",   <UnderlineIcon size={14} />],
                  ["strikeThrough", <Strikethrough size={14} />],
                ] as [string, React.ReactNode][]).map(([cmd, icon]) => (
                  <button
                    key={cmd}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); execFormat(cmd); }}
                    className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition"
                    title={cmd}
                  >
                    {icon}
                  </button>
                ))}
                <div className="w-px h-5 bg-gray-300 mx-1" />
                {([
                  ["justifyLeft",   <AlignLeft size={14} />],
                  ["justifyCenter", <AlignCenter size={14} />],
                  ["justifyRight",  <AlignRight size={14} />],
                ] as [string, React.ReactNode][]).map(([cmd, icon]) => (
                  <button
                    key={cmd}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); execFormat(cmd); }}
                    className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition"
                    title={cmd}
                  >
                    {icon}
                  </button>
                ))}
                <div className="w-px h-5 bg-gray-300 mx-1" />
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execFormat("insertUnorderedList"); }}
                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition" title="Bullet list">
                  <List size={14} />
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); execFormat("insertOrderedList"); }}
                  className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 transition" title="Numbered list">
                  <ListOrdered size={14} />
                </button>
                <div className="w-px h-5 bg-gray-300 mx-1" />
                {/* Font size */}
                <select
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => { execFormat("fontSize", e.target.value); e.target.value = ""; }}
                  className="text-[12px] text-gray-600 bg-transparent border border-gray-200 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>Size</option>
                  {["1","2","3","4","5","6"].map(s => (
                    <option key={s} value={s}>{["8","10","12","14","18","24"][+s-1]}px</option>
                  ))}
                </select>
              </div>
              {/* Content-editable editor */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Start writing your custom letter here..."
                className="w-full min-h-[280px] border border-gray-100 rounded-b-2xl px-5 py-4 text-[13px] text-gray-800 font-medium leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#F2924E]/30 focus:border-[#F2924E]/40 bg-gray-50/30 transition [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-gray-400"
                style={{ whiteSpace: "pre-wrap" }}
              />
            </div>

            {error && (
              <p className="text-[13px] text-red-500 font-bold text-center bg-red-50 border border-red-100 rounded-lg p-3">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-6 flex gap-4">
            <button onClick={onClose} className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[14px] font-bold rounded-2xl transition">
              Cancel
            </button>
            <button
              onClick={handleSendCustomLetter}
              disabled={loadingCustomSend || !editorRef.current?.innerHTML?.trim()}
              className="flex-[1.5] py-4 bg-[#F2924E] hover:bg-[#e07d3a] text-white text-[14px] font-bold rounded-2xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 disabled:shadow-none"
            >
              {loadingCustomSend ? (
                <><RefreshCw size={18} className="animate-spin" /> Sending...</>
              ) : (
                <><Send size={18} /> Send Custom Letter</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────
   *  Render: Normal Template Mode
   * ────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-backdrop">
      <div
        className={`bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col transition-all duration-300 animate-modal ${
          previewMode ? "w-[900px] max-h-[90vh]" : "w-[680px] max-h-[90vh]"
        }`}
      >
        {/* Header */}
        <div className="px-8 py-6 flex items-start justify-between">
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
              <p className="text-[14px] font-bold text-gray-900 leading-snug line-clamp-2">{request.reason}</p>
            </div>
          </div>

          {/* Template Selector */}
          <div className="relative z-10 w-full">
            {loadingTemplates ? (
              <div className="w-full border border-gray-100 bg-gray-50 rounded-[16px] px-6 py-5 text-sm text-gray-400 animate-pulse">
                Loading templates...
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full border-0 bg-gray-50/80 rounded-[16px] px-6 py-5 text-[15px] font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F2924E]/30 transition appearance-none cursor-pointer shadow-sm"
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

          {/* Document Preview Box */}
          {!isPdf && (
            !previewMode ? (
              <div className="shrink-0 bg-white rounded-[32px] p-12 flex flex-col items-center justify-center text-center relative overflow-hidden transition-all shadow-md min-h-[300px]">
                <div className="px-8 py-4 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mb-6">
                  {selectedType === "DOCX"
                    ? <FileCode size={32} className="text-green-500" />
                    : <FileText size={32} className="text-gray-400" />
                  }
                </div>
                
                <h3 className="font-bold text-gray-900 text-[18px] mb-6 tracking-tight">Auto-Generated Document</h3>

                {canPreview && (
                  <button
                    onClick={handleTogglePreview}
                    disabled={loadingPreview || !selectedTemplate}
                    className="bg-orange-50 hover:bg-orange-100 text-[#F2924E] border border-orange-200 text-[15px] font-bold py-3 px-8 rounded-xl transition shadow-md hover:shadow-lg flex items-center gap-2 mb-6 disabled:opacity-60 disabled:shadow-none"
                  >
                    {loadingPreview ? <RefreshCw size={20} className="animate-spin" /> : <Eye size={20} />}
                    Show Preview
                  </button>
                )}

                <p className="text-[14px] text-gray-500 font-medium">
                  {canPreview
                    ? selectedType === "DOCX" ? "Click to see the filled DOCX file" : "Click to see the filled HTML document"
                    : "Generate & Send below"}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col h-full text-left">
                <div className="flex justify-between items-center mb-6 pb-4">
                  <h3 className="font-bold text-gray-900 text-[15px] flex items-center gap-2">
                    <FileText size={18} className="text-[#F2924E]" />
                    Document Preview
                  </h3>
                  <button
                    onClick={handleTogglePreview}
                    className="text-gray-500 hover:text-gray-800 text-[13px] font-bold flex items-center gap-1.5 hover:bg-gray-100 px-4 py-2 rounded-xl transition shadow-sm"
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
        <div className="px-8 py-6 flex gap-4 mt-auto">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[14px] font-bold rounded-2xl transition"
          >
            Cancel
          </button>
          
          <button
            onClick={handleGenerateAndSend}
            disabled={loadingGenerate || !selectedTemplate || isPdf}
            className="flex-[1.5] py-4 bg-[#F2924E] hover:bg-[#e07d3a] text-white text-[14px] font-bold rounded-2xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 disabled:shadow-none"
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
