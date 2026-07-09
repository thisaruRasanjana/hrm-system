"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PromotionLetterModalProps {
  employeeId: number;
  newDesignationId: number | null;
  effectiveDate?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

type ModalState = "loading" | "no_template" | "preview" | "sending" | "sent" | "error";

// ─── Component ────────────────────────────────────────────────────────────────

export default function PromotionLetterModal({
  employeeId,
  newDesignationId,
  effectiveDate,
  onClose,
  onSuccess,
}: PromotionLetterModalProps) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<ModalState>("loading");
  const [previewHtml, setPreviewHtml] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [resolvedDesignationName, setResolvedDesignationName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // ── Fetch preview on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const res = await apiFetch(`/promotion-letter/${employeeId}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            new_designation_id: newDesignationId,
            effective_date: effectiveDate || null,
          }),
        });

        if (res.status === 404) {
          const body = await res.json();
          if (body?.detail === "TEMPLATE_MISSING") {
            setState("no_template");
            return;
          }
          throw new Error(body?.detail || "Employee not found.");
        }

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.detail || "Failed to generate preview.");
        }

        const data = await res.json();
        setPreviewHtml(data.preview_html || "");
        setTemplateName(data.template_name || "Promotion Letter");
        setEmployeeEmail(data.employee_email || "");
        setResolvedDesignationName(data.new_designation_name || "New Position");
        setState("preview");
      } catch (err: any) {
        setErrorMsg(err?.message || "An unexpected error occurred.");
        setState("error");
      }
    };

    fetchPreview();
  }, [employeeId, newDesignationId, effectiveDate]);

  // ── Send the letter ────────────────────────────────────────────────────────
  const handleSend = async () => {
    const editedHtml = editorRef.current?.innerHTML || previewHtml;
    setState("sending");
    try {
      const payload = {
        html_content: editedHtml,
        new_designation_id: newDesignationId,
        effective_date: effectiveDate || null,
      };

      const res = await apiFetch(`/promotion-letter/${employeeId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || "Failed to send promotion letter.");
      }

      setState("sent");
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred while sending.");
      setState("error");
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderContent = () => {
    if (state === "loading") {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-gray-400">
          <div className="w-8 h-8 border-2 border-[#EE7F22]/30 border-t-[#EE7F22] rounded-full animate-spin" />
          <p className="text-sm">Generating letter preview…</p>
        </div>
      );
    }

    if (state === "no_template") {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 text-base">No Promotion Letter Template Found</h3>
            <p className="text-sm text-gray-500 mt-2 max-w-sm">
              There is no template named <span className="font-semibold text-gray-700">"Promotion Letter"</span> in the system.
              Please upload one in Template Management to continue.
            </p>
          </div>
          <button
            onClick={() => {
              onClose();
              router.push("/dashboard/documents/templates_management");
            }}
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-[#EE7F22] text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors shadow-sm"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Go to Template Management
          </button>
        </div>
      );
    }

    if (state === "sent") {
      return (
        <div className="flex flex-col items-center justify-center py-14 gap-4 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 text-base">Promotion Letter Sent!</h3>
            <p className="text-sm text-gray-500 mt-1.5">
              The letter has been emailed to <span className="font-semibold text-gray-700">{employeeEmail}</span>.
            </p>
          </div>
          <button
            onClick={() => {
              onSuccess && onSuccess();
              onClose();
            }}
            className="mt-2 px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      );
    }

    if (state === "error") {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Something went wrong</h3>
            <p className="text-sm text-red-500 mt-1.5 max-w-sm">{errorMsg}</p>
          </div>
          <button
            onClick={onClose}
            className="mt-2 px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      );
    }

    // state === "preview" | "sending"
    return (
      <div className="flex flex-col gap-0">
        {/* Template name badge */}
        <div className="px-6 pb-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#EE7F22] bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            {templateName}
          </span>
          <span className="text-xs text-gray-400">· You can edit the letter below before sending</span>
        </div>

        {/* Editable document preview — styled like a real letter */}
        <div className="mx-6 mb-5 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {/* Paper background */}
          <div className="bg-gray-50 border-b border-gray-100 px-4 py-2 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-300" />
            <span className="text-xs text-gray-400 ml-2">Promotion Letter Preview — click to edit</span>
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: previewHtml }}
            className="min-h-[360px] max-h-[480px] overflow-y-auto p-8 bg-white text-[13px] text-gray-800 leading-relaxed outline-none focus:ring-2 focus:ring-[#EE7F22]/20 cursor-text [&_p]:mb-3 [&_h1]:text-lg [&_h2]:text-base [&_strong]:font-semibold"
            style={{ fontFamily: "'Georgia', serif" }}
          />
        </div>

        {/* Footer info */}
        {employeeEmail && (
          <p className="px-6 text-xs text-gray-400 mb-4">
            Will be emailed to: <span className="font-semibold text-gray-600">{employeeEmail}</span>
          </p>
        )}
      </div>
    );
  };

  const isPreviewState = state === "preview" || state === "sending";

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal panel */}
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EE7F22]/10 flex items-center justify-center text-[#EE7F22]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">Send Promotion Letter</h2>
              <p className="text-[#EE7F22] text-[13px] font-medium leading-none">
                Promoting to: <span className="font-bold">{resolvedDesignationName || "Loading..."}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto pt-4">
          {renderContent()}
        </div>

        {/* Footer actions — only shown in preview/sending state */}
        {isPreviewState && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50/50">
            <p className="text-xs text-gray-400">Make any edits directly in the document above before sending.</p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={state === "sending"}
                className="px-4 py-2 text-sm rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={state === "sending"}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm rounded-xl bg-[#EE7F22] text-white font-semibold hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-60"
              >
                {state === "sending" ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Send Letter
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
