"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";
import {
  FileText,
  Plus,
  Download,
  X,
  Search,
  Filter,
  FileCheck2,
  FileCode,
  Trash2,
  Eye,
  RefreshCw,
  Mail,
  Settings,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface DocumentRequest {
  id: string;
  employee_id: number | null;
  employee_name: string | null;
  document_type: string;
  reason: string;
  status: string;
  source: "INTERNAL" | "EXTERNAL";
  requester_email: string | null;
  created_at: string;
  rejection_reason: string | null;
  generated_document_path: string | null;
}

interface EmployeeDocument {
  id: string;
  employee_id: number | string;
  employee_name?: string;
  document_type: string;
  is_mandatory: boolean;
  status: string;
  uploaded_at: string;
  rejection_reason: string | null;
  file_path?: string;
}

interface Template {
  id: number;
  name: string;
  category: string;
  template_type: "HTML" | "DOCX";
  content: string | null;
  file_path: string | null;
  created_at: string;
}

interface DocumentType {
  id: string;
  name: string;
  description: string | null;
  is_mandatory: boolean;
  is_active: boolean;
  created_at: string;
}

export default function DocumentsPage() {
  const { user, hasAnyPermission } = useAuth();
  const isHR = hasAnyPermission([
    "document:manage_templates",
    "document:view_all",
  ]);

  const [activeTab, setActiveTab] = useState<string>("requests");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Employee states
  const [myRequests, setMyRequests] = useState<DocumentRequest[]>([]);
  const [myDocuments, setMyDocuments] = useState<EmployeeDocument[]>([]);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [activeDocTypes, setActiveDocTypes] = useState<DocumentType[]>([]);

  // HR states
  const [allRequests, setAllRequests] = useState<DocumentRequest[]>([]);
  const [pendingDocs, setPendingDocs] = useState<EmployeeDocument[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [requestStatusFilter, setRequestStatusFilter] = useState("All");
  const [selectedRequest, setSelectedRequest] =
    useState<DocumentRequest | null>(null);
  const [customLetterText, setCustomLetterText] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "">("");

  // HR Template Modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [templateType, setTemplateType] = useState<"HTML" | "DOCX">("HTML");
  const [templateContent, setTemplateContent] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);

  // HR Type Modal
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeName, setTypeName] = useState("");
  const [typeDesc, setTypeDesc] = useState("");
  const [typeMandatory, setTypeMandatory] = useState(false);

  // ── Approval Modal State ─────────────────────────────────────────────────────
  const [selectedApprovalDoc, setSelectedApprovalDoc] =
    useState<EmployeeDocument | null>(null);
  const [approvalRejectMode, setApprovalRejectMode] = useState(false);
  const [approvalRejectReason, setApprovalRejectReason] = useState("");
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalError, setApprovalError] = useState("");

  // ── Template Preview State ────────────────────────────────────────────────────
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Request Stat Card Filter ──────────────────────────────────────────────────
  const [requestStatFilter, setRequestStatFilter] = useState<
    "ALL" | "NEW" | "IN_PROGRESS" | "COMPLETED"
  >("ALL");

  useEffect(() => {
    if (user?.id) loadTabData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeTab, requestStatusFilter]);

  const loadTabData = () => {
    if (activeTab === "requests") fetchMyRequests();
    if (activeTab === "upload") {
      fetchMyUploadedDocs();
      fetchActiveTypes();
    }
    if (isHR) {
      if (activeTab === "all_requests") fetchAllRequests();
      if (activeTab === "approval") fetchPendingDocs();
      if (activeTab === "templates") fetchTemplates();
      if (activeTab === "types") fetchDocTypes();
    }
  };

  // ── Employee API ──────────────────────────────────────────────────────────────

  const fetchMyRequests = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await api.get<DocumentRequest[]>(
        `/document-requests/${user.id}`,
      );
      setMyRequests(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchMyUploadedDocs = async () => {
    if (!user?.id) return;
    try {
      const data = await api.get<EmployeeDocument[]>(
        `/documents/my-documents?employee_id=${user.id}`,
      );
      setMyDocuments(data);
    } catch (err: any) {
      console.error("Failed to fetch docs:", err);
    }
  };

  const fetchActiveTypes = async () => {
    try {
      const data = await api.get<DocumentType[]>("/api/document-types/active/");
      setActiveDocTypes(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch types");
    }
  };

  const handleNewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !selectedDocType || !requestReason) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/document-requests/", {
        employee_id: user.id,
        document_type: selectedDocType,
        reason: requestReason,
      });
      setShowNewRequestModal(false);
      setSelectedDocType("");
      setRequestReason("");
      fetchMyRequests();
    } catch (err: any) {
      setError(err.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  const handleInlineUpload = async (
    file: File,
    typeId: string,
    isMandatoryFlag: boolean,
  ) => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try {
      const token = sessionStorage.getItem("access_token");
      const formData = new FormData();
      formData.append("employee_id", user.id.toString());
      formData.append("document_type_id", typeId);
      formData.append("is_mandatory", isMandatoryFlag.toString());
      formData.append("file", file);
      const res = await fetch("http://localhost:8000/documents/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Upload failed");
      }
      fetchMyUploadedDocs();
    } catch (err: any) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── HR API ────────────────────────────────────────────────────────────────────

  const fetchAllRequests = async () => {
    setLoading(true);
    try {
      const statusParam =
        requestStatusFilter === "All" ? "" : `?status=${requestStatusFilter}`;
      const data = await api.get<DocumentRequest[]>(
        `/hr-document-requests/${statusParam}`,
      );
      setAllRequests(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingDocs = async () => {
    setLoading(true);
    try {
      const data = await api.get<EmployeeDocument[]>(
        "/documents/review/pending",
      );
      setPendingDocs(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch pending docs");
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await api.get<Template[]>("/document-templates/");
      setTemplates(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch templates");
    } finally {
      setLoading(false);
    }
  };

  const fetchDocTypes = async () => {
    setLoading(true);
    try {
      const data = await api.get<DocumentType[]>("/api/document-types/");
      setDocTypes(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch types");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (
    id: string,
    status: string,
    reason?: string,
  ) => {
    try {
      await api.put(`/hr-document-requests/${id}/status`, {
        status,
        rejection_reason: reason,
      });
      fetchAllRequests();
      if (selectedRequest?.id === id) {
        setSelectedRequest((prev) =>
          prev
            ? {
                ...prev,
                status: status as any,
                rejection_reason: reason || null,
              }
            : null,
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to update status");
    }
  };

  const handleGenerateDocument = async (requestId: string) => {
    if (!selectedTemplateId) return;
    setLoading(true);
    try {
      const res = await api.post<{ document_path: string }>(
        `/hr-document-requests/${requestId}/generate`,
        {
          template_id: Number(selectedTemplateId),
          preview: false,
        },
      );
      alert(`Document generated: ${res.document_path}`);
      fetchAllRequests();
    } catch (err: any) {
      setError(err.message || "Failed to generate document");
    } finally {
      setLoading(false);
    }
  };

  const handleSendCustomLetter = async (requestId: string) => {
    if (!customLetterText.trim()) return;
    setLoading(true);
    try {
      await api.post(`/hr-document-requests/${requestId}/custom-letter`, {
        content: customLetterText,
      });
      setCustomLetterText("");
      alert("Custom letter generated and sent!");
      fetchAllRequests();
    } catch (err: any) {
      setError(err.message || "Failed to send letter");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm("Delete this template?")) return;
    try {
      await api.delete(`/document-templates/${id}`);
      fetchTemplates();
    } catch (err: any) {
      setError(err.message || "Failed to delete template");
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = sessionStorage.getItem("access_token");
      const formData = new FormData();
      formData.append("name", templateName);
      formData.append("category", templateCategory);
      formData.append("template_type", templateType);
      if (templateType === "HTML") formData.append("content", templateContent);
      if (templateType === "DOCX" && templateFile)
        formData.append("file", templateFile);
      const res = await fetch("http://localhost:8000/document-templates/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to create template");
      setShowTemplateModal(false);
      setTemplateName("");
      setTemplateCategory("");
      setTemplateContent("");
      setTemplateFile(null);
      fetchTemplates();
    } catch (err: any) {
      setError(err.message || "Failed to create template");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/api/document-types/", {
        name: typeName,
        description: typeDesc,
        is_mandatory: typeMandatory,
      });
      setShowTypeModal(false);
      setTypeName("");
      setTypeDesc("");
      setTypeMandatory(false);
      fetchDocTypes();
    } catch (err: any) {
      setError(err.message || "Failed to create type");
    }
  };

  const toggleTypeActive = async (id: string, current: boolean) => {
    try {
      await api.patch(`/api/document-types/${id}`, { is_active: !current });
      fetchDocTypes();
    } catch (err: any) {
      setError(err.message || "Failed to toggle status");
    }
  };

  const handleSyncEmails = async () => {
    setLoading(true);
    try {
      await api.post("/hr-document-requests/sync-emails", {});
      fetchAllRequests();
      alert("Synced external email requests!");
    } catch (err: any) {
      setError(err.message || "Failed to sync emails");
    } finally {
      setLoading(false);
    }
  };

  // ── Approval Modal Actions ────────────────────────────────────────────────────

  const handleApproveDocModal = async () => {
    if (!selectedApprovalDoc) return;
    setApprovalLoading(true);
    setApprovalError("");
    try {
      await api.patch(
        `/documents/review/${selectedApprovalDoc.id}/approve`,
        {},
      );
      await fetchPendingDocs();
      setSelectedApprovalDoc(null);
      setApprovalRejectMode(false);
    } catch {
      setApprovalError("Failed to approve. Please try again.");
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleRejectDocModal = async () => {
    if (!approvalRejectReason.trim()) {
      setApprovalError("Please enter a rejection reason.");
      return;
    }
    if (!selectedApprovalDoc) return;
    setApprovalLoading(true);
    setApprovalError("");
    try {
      await api.patch(`/documents/review/${selectedApprovalDoc.id}/reject`, {
        reason: approvalRejectReason,
      });
      await fetchPendingDocs();
      setSelectedApprovalDoc(null);
      setApprovalRejectMode(false);
      setApprovalRejectReason("");
    } catch {
      setApprovalError("Failed to reject. Please try again.");
    } finally {
      setApprovalLoading(false);
    }
  };

  // ── Template Preview Handler ──────────────────────────────────────────────────

  const openTemplatePreview = async (tpl: Template) => {
    setPreviewTemplate(tpl);
    setPreviewHtml(null);
    if (tpl.template_type === "HTML" && tpl.content) {
      setPreviewHtml(tpl.content);
      return;
    }
    if (tpl.template_type === "DOCX") {
      setPreviewLoading(true);
      try {
        const data = await api.get<{ preview_html: string }>(
          `/document-templates/${tpl.id}/preview`,
        );
        setPreviewHtml(data.preview_html);
      } catch {
        setPreviewHtml(
          "<p style='color:#ef4444;padding:1rem'>Failed to load DOCX preview. The template file may not be accessible.</p>",
        );
      } finally {
        setPreviewLoading(false);
      }
    }
  };

  // ── Request Stat Card Computed Values ─────────────────────────────────────────

  const newRequests = allRequests.filter(
    (r) => r.status === "PENDING" || r.status === "NEW",
  );
  const inProgressRequests = allRequests.filter(
    (r) => r.status === "IN_PROGRESS",
  );
  const completedRequests = allRequests.filter(
    (r) => r.status === "COMPLETED" || r.status === "REJECTED",
  );

  const filteredByStatCard =
    requestStatFilter === "NEW"
      ? newRequests
      : requestStatFilter === "IN_PROGRESS"
        ? inProgressRequests
        : requestStatFilter === "COMPLETED"
          ? completedRequests
          : allRequests;

  // ── Computed values ───────────────────────────────────────────────────────────

  const mandatoryTypes = activeDocTypes.filter((t) => t.is_mandatory);
  const optionalTypes = activeDocTypes.filter((t) => !t.is_mandatory);

  const uploadedMandatory = mandatoryTypes.filter((t) =>
    myDocuments.some((d) => d.document_type === t.name),
  ).length;

  const approvedMandatory = mandatoryTypes.filter((t) =>
    myDocuments.some(
      (d) => d.document_type === t.name && d.status === "APPROVED",
    ),
  ).length;

  const uploadPercent =
    mandatoryTypes.length > 0
      ? (uploadedMandatory / mandatoryTypes.length) * 100
      : 0;

  function getTypeDocStatus(
    typeName: string,
  ): "NOT_UPLOADED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" {
    const doc = myDocuments.find((d) => d.document_type === typeName);
    if (!doc) return "NOT_UPLOADED";
    if (doc.status === "APPROVED") return "APPROVED";
    if (doc.status === "REJECTED") return "REJECTED";
    return "PENDING_REVIEW";
  }

  const DOC_BADGE: Record<string, { label: string; cls: string }> = {
    NOT_UPLOADED: { label: "Not Uploaded", cls: "bg-gray-100 text-gray-500" },
    PENDING_REVIEW: {
      label: "Pending Review",
      cls: "bg-yellow-100 text-yellow-700",
    },
    APPROVED: { label: "Approved", cls: "bg-green-100 text-green-600" },
    REJECTED: { label: "Rejected", cls: "bg-red-100 text-red-600" },
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-700",
      PENDING_REVIEW: "bg-yellow-100 text-yellow-700",
      IN_PROGRESS: "bg-blue-100 text-blue-700",
      APPROVED: "bg-teal-100 text-teal-700",
      COMPLETED: "bg-green-100 text-green-700",
      REJECTED: "bg-red-100 text-red-700",
    };
    return (
      <span
        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`}
      >
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  const tabs = [
    { id: "requests", label: "My Requests" },
    { id: "upload", label: "My Documents" },
  ];
  if (isHR) {
    tabs.push(
      { id: "all_requests", label: "All Requests" },
      { id: "approval", label: "Approvals" },
      { id: "templates", label: "Templates" },
      { id: "types", label: "Document Types" },
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-20">
      {/* ── Header ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-[#F2924E] rounded-xl">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Document Management
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Request official documents and upload mandatory compliance files.
            </p>
          </div>
        </div>
        {isHR && activeTab === "all_requests" && (
          <button
            onClick={handleSyncEmails}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Sync External Emails
          </button>
        )}
      </div>

      {/* ── Pill Tabs ── */}
      <div className="inline-flex bg-white p-1 rounded-full shadow-md border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-[#F2924E] text-white shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ═══════════════════════ TAB CONTENT ═══════════════════════════════ */}
      <div className="min-h-[400px]">
        {/* ── MY REQUESTS ────────────────────────────────────────────────── */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowNewRequestModal(true);
                  fetchActiveTypes();
                }}
                className="flex items-center gap-2 bg-[#F2924E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#e4833f] transition shadow-sm"
              >
                <Plus size={16} /> New Request
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Document Type
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Download
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && myRequests.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-gray-400"
                      >
                        <div className="flex justify-center items-center gap-2">
                          <div className="w-4 h-4 border-2 border-[#F2924E] border-t-transparent rounded-full animate-spin" />
                          Loading requests...
                        </div>
                      </td>
                    </tr>
                  ) : myRequests.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-gray-400 italic"
                      >
                        No requests yet. Click &quot;New Request&quot; to get
                        started.
                      </td>
                    </tr>
                  ) : (
                    myRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          {req.document_type}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {req.reason}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(req.status)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(req.created_at).toLocaleDateString("en-GB")}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {req.status === "COMPLETED" &&
                          req.generated_document_path ? (
                            <a
                              href={`http://localhost:8000/${req.generated_document_path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#F2924E] hover:underline flex items-center gap-1 font-medium"
                            >
                              <Download size={14} /> Download
                            </a>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── MY DOCUMENTS (upload tab) ──────────────────────────────────── */}
        {activeTab === "upload" && (
          <div className="space-y-6">
            {/* Progress Bar */}
            {activeDocTypes.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-800 mb-2">
                  Document Completion
                </h3>
                <p className="text-sm text-gray-500 mb-3">
                  <span className="font-medium text-[#F2924E]">
                    {uploadedMandatory} of {mandatoryTypes.length} mandatory
                    documents uploaded
                  </span>
                  {approvedMandatory > 0 && (
                    <span className="text-green-600 text-xs ml-2">
                      ({approvedMandatory} approved by HR)
                    </span>
                  )}
                </p>
                <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#F2924E] h-full rounded-full transition-all duration-700"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {mandatoryTypes.length - uploadedMandatory} mandatory
                  documents still to upload
                </p>
              </div>
            )}

            {/* Empty state */}
            {activeDocTypes.length === 0 && !loading && (
              <div className="bg-white p-14 rounded-xl shadow-sm text-center border border-gray-100">
                <FileText size={44} className="mx-auto mb-4 text-gray-200" />
                <p className="text-gray-500 text-lg font-medium">
                  No document types configured yet
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  HR will set up required document types shortly.
                </p>
              </div>
            )}

            {/* Mandatory Docs */}
            {mandatoryTypes.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-3">
                <h2 className="text-lg font-semibold text-gray-800">
                  Mandatory Documents
                </h2>
                {mandatoryTypes.map((type) => {
                  const status = getTypeDocStatus(type.name);
                  const doc = myDocuments.find(
                    (d) => d.document_type === type.name,
                  );
                  const badge = DOC_BADGE[status];
                  const inputId = `upload-mandatory-${type.id}`;
                  return (
                    <div
                      key={type.id}
                      className="flex items-center justify-between border border-gray-100 rounded-xl p-4 hover:bg-gray-50/50 transition"
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <h4 className="font-medium text-gray-800">
                          {type.name}
                        </h4>
                        {type.description && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {type.description}
                          </p>
                        )}
                        {status === "REJECTED" && doc?.rejection_reason && (
                          <p className="text-xs text-red-500 mt-1 font-medium">
                            Rejection reason: {doc.rejection_reason}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                        {status !== "APPROVED" && (
                          <>
                            <input
                              id={inputId}
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleInlineUpload(f, type.id, true);
                                e.target.value = "";
                              }}
                            />
                            <label
                              htmlFor={inputId}
                              className={`px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer transition ${
                                status === "NOT_UPLOADED"
                                  ? "bg-[#F2924E] text-white hover:bg-[#e4833f]"
                                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                              }`}
                            >
                              {status === "NOT_UPLOADED" ? "Upload" : "Replace"}
                            </label>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Optional Docs */}
            {optionalTypes.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-3">
                <h2 className="text-lg font-semibold text-gray-800">
                  Optional Documents
                </h2>
                {optionalTypes.map((type) => {
                  const status = getTypeDocStatus(type.name);
                  const doc = myDocuments.find(
                    (d) => d.document_type === type.name,
                  );
                  const badge = DOC_BADGE[status];
                  const inputId = `upload-optional-${type.id}`;
                  return (
                    <div
                      key={type.id}
                      className="flex items-center justify-between border border-gray-100 rounded-xl p-4 hover:bg-gray-50/50 transition"
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <h4 className="font-medium text-gray-800">
                          {type.name}
                        </h4>
                        {type.description && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {type.description}
                          </p>
                        )}
                        {status === "REJECTED" && doc?.rejection_reason && (
                          <p className="text-xs text-red-500 mt-1 font-medium">
                            Rejection reason: {doc.rejection_reason}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                        {status !== "APPROVED" && (
                          <>
                            <input
                              id={inputId}
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleInlineUpload(f, type.id, false);
                                e.target.value = "";
                              }}
                            />
                            <label
                              htmlFor={inputId}
                              className={`px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer transition ${
                                status === "NOT_UPLOADED"
                                  ? "bg-gray-700 text-white hover:bg-gray-800"
                                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                              }`}
                            >
                              {status === "NOT_UPLOADED" ? "Upload" : "Replace"}
                            </label>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── HR: ALL REQUESTS ───────────────────────────────────────────── */}
        {isHR && activeTab === "all_requests" && (
          <div className="space-y-4">
            {/* Stat Card Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  id: "NEW" as const,
                  label: "New Requests",
                  count: newRequests.length,
                  activeColor:
                    "border-[#F2924E] ring-1 ring-[#F2924E] shadow-sm",
                  iconBg: "bg-orange-100 text-[#F2924E]",
                  inactiveBg: "bg-orange-50/50 text-[#F2924E]/70",
                },
                {
                  id: "IN_PROGRESS" as const,
                  label: "In Progress",
                  count: inProgressRequests.length,
                  activeColor: "border-gray-800 ring-1 ring-gray-800 shadow-sm",
                  iconBg: "bg-gray-200 text-gray-800",
                  inactiveBg: "bg-gray-50 text-gray-400",
                },
                {
                  id: "COMPLETED" as const,
                  label: "Completed / Rejected",
                  count: completedRequests.length,
                  activeColor:
                    "border-green-500 ring-1 ring-green-500 shadow-sm",
                  iconBg: "bg-green-100 text-green-700",
                  inactiveBg: "bg-green-50/50 text-green-400",
                },
              ].map((card) => (
                <button
                  key={card.id}
                  onClick={() =>
                    setRequestStatFilter((prev) =>
                      prev === card.id ? "ALL" : card.id,
                    )
                  }
                  className={`p-5 rounded-2xl bg-white border flex items-center justify-between cursor-pointer transition-all text-left ${
                    requestStatFilter === card.id
                      ? card.activeColor
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                      {card.label}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {card.count}
                    </p>
                  </div>
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
                      requestStatFilter === card.id
                        ? card.iconBg
                        : card.inactiveBg
                    }`}
                  >
                    <FileCheck2 size={22} />
                  </div>
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Document
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Source
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && allRequests.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-gray-400"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : filteredByStatCard.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-gray-400 italic"
                      >
                        No requests matching criteria
                      </td>
                    </tr>
                  ) : (
                    filteredByStatCard.map((req) => (
                      <tr
                        key={req.id}
                        className="hover:bg-gray-50 transition text-sm"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">
                            {req.employee_name || "N/A"}
                          </div>
                          {req.requester_email && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              {req.requester_email}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-700">
                          {req.document_type}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(req.status)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${req.source === "EXTERNAL" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}
                          >
                            {req.source}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {new Date(req.created_at).toLocaleDateString("en-GB")}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => {
                              setSelectedRequest(req);
                              fetchTemplates();
                            }}
                            className="flex items-center gap-1.5 text-[#F2924E] font-semibold hover:underline"
                          >
                            <Eye size={15} /> View / Process
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── HR: APPROVALS ──────────────────────────────────────────────── */}
        {isHR && activeTab === "approval" && (
          <div className="space-y-4">
            {/* Stat Card */}
            <div className="bg-white border border-orange-200 rounded-xl p-6 flex justify-between items-center shadow-sm">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  PENDING REVIEW
                </p>
                <h2 className="text-4xl font-bold text-gray-900 mt-1">
                  {pendingDocs.length}
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  documents require your attention
                </p>
              </div>
              <Clock size={36} className="text-[#F2924E]" strokeWidth={2} />
            </div>

            {/* Doc List */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              {pendingDocs.length === 0 ? (
                <div className="p-14 text-center text-gray-400">
                  <CheckCircle
                    size={44}
                    className="mx-auto mb-3 text-green-300"
                  />
                  <p className="font-semibold text-gray-500">All caught up!</p>
                  <p className="text-sm mt-1">No documents pending approval.</p>
                </div>
              ) : (
                pendingDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#F2924E] text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                        {(doc.employee_name || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {doc.employee_name || `Employee ${doc.employee_id}`}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {doc.document_type}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(doc.uploaded_at).toLocaleDateString(
                            "en-GB",
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                        Pending Review
                      </span>
                      <button
                        onClick={() => {
                          setSelectedApprovalDoc(doc);
                          setApprovalRejectMode(false);
                          setApprovalRejectReason("");
                          setApprovalError("");
                        }}
                        className="bg-[#F2924E] hover:bg-[#e4833f] text-white px-5 py-2 rounded-lg text-sm font-semibold transition shadow-sm"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── HR: TEMPLATES ──────────────────────────────────────────────── */}
        {isHR && activeTab === "templates" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Document Templates
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {templates.length} template{templates.length !== 1 ? "s" : ""}{" "}
                  available
                </p>
              </div>
              <button
                onClick={() => setShowTemplateModal(true)}
                className="flex items-center gap-2 bg-[#F2924E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#e4833f] transition shadow-sm"
              >
                <Plus size={16} /> Create Template
              </button>
            </div>

            {templates.length === 0 ? (
              <div className="bg-white border rounded-xl p-16 text-center text-gray-400">
                <FileCode size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-medium text-gray-500">No templates yet</p>
                <p className="text-sm mt-1">
                  Click &quot;Create Template&quot; to add your first one.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#F2924E]/10 rounded-xl flex items-center justify-center shrink-0">
                        <FileCode size={18} className="text-[#F2924E]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">
                          {tpl.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {tpl.category}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openTemplatePreview(tpl)}
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                          title="Preview"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tpl.id)}
                          className="p-1.5 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 transition"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${tpl.template_type === "HTML" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}
                      >
                        {tpl.template_type}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide bg-gray-100 text-gray-600">
                        {tpl.category}
                      </span>
                    </div>

                    {tpl.template_type === "HTML" && tpl.content && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-400 line-clamp-2 leading-relaxed border border-gray-100 font-mono">
                        {tpl.content
                          .replace(/<[^>]+>/g, " ")
                          .trim()
                          .slice(0, 120)}
                        …
                      </div>
                    )}
                    {tpl.template_type !== "HTML" && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-400 border border-gray-100 flex items-center gap-2">
                        <FileText size={12} />
                        {tpl.file_path?.split("/").pop() ?? "Uploaded file"}
                      </div>
                    )}

                    <p className="text-xs text-gray-300">
                      Created{" "}
                      {new Date(tpl.created_at).toLocaleDateString("en-GB", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── HR: DOCUMENT TYPES ─────────────────────────────────────────── */}
        {isHR && activeTab === "types" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setShowTypeModal(true)}
                className="flex items-center gap-2 bg-[#F2924E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#e4833f] transition shadow-sm"
              >
                <Plus size={16} /> Add Type
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">
                  All Document Types
                </span>
                <span className="text-xs text-gray-400">
                  {docTypes.length} types
                </span>
              </div>
              {docTypes.length === 0 ? (
                <div className="p-12 text-center text-gray-400 italic text-sm">
                  No document types defined yet
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 text-left">Name</th>
                      <th className="px-6 py-3 text-left">Description</th>
                      <th className="px-6 py-3 text-center">Mandatory</th>
                      <th className="px-6 py-3 text-center">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {docTypes.map((type) => (
                      <tr
                        key={type.id}
                        className="hover:bg-gray-50/50 transition"
                      >
                        <td className="px-6 py-4 font-semibold text-gray-800">
                          {type.name}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {type.description || "—"}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {type.is_mandatory ? (
                            <span className="px-2 py-0.5 bg-[#F2924E]/10 text-[#F2924E] text-xs font-bold rounded-full">
                              Mandatory
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-bold rounded-full">
                              Optional
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${type.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}
                          >
                            {type.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() =>
                              toggleTypeActive(type.id, type.is_active)
                            }
                            className="text-gray-500 hover:text-[#F2924E] transition text-xs font-semibold mr-4"
                          >
                            {type.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button className="text-gray-300 hover:text-red-500 transition">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════ MODALS ═══════════════════════════════ */}

      {/* Employee: New Request Modal */}
      {showNewRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">
                Submit New Request
              </h3>
              <button
                onClick={() => setShowNewRequestModal(false)}
                className="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleNewRequest} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Document Type
                </label>
                <select
                  value={selectedDocType}
                  onChange={(e) => setSelectedDocType(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#F2924E]/30 focus:border-[#F2924E] outline-none transition"
                  required
                >
                  <option value="">Select a document type</option>
                  {activeDocTypes.map((type) => (
                    <option key={type.id} value={type.name}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Reason / Purpose
                </label>
                <textarea
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="Why do you need this document?"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm min-h-[100px] focus:ring-2 focus:ring-[#F2924E]/30 focus:border-[#F2924E] outline-none transition resize-none"
                  required
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewRequestModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#F2924E] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#e4833f] transition disabled:opacity-50 shadow-sm"
                >
                  {loading ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HR: Request Detail Side Drawer */}
      {selectedRequest && (
        <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px] flex justify-end overflow-hidden">
          <div className="w-full max-w-xl bg-white h-screen shadow-2xl flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Request Details
                </h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  {selectedRequest.id.slice(0, 24)}…
                </p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-2 hover:bg-gray-200 rounded-xl transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                    Employee
                  </label>
                  <p className="font-semibold text-gray-900">
                    {selectedRequest.employee_name || "External"}
                  </p>
                  {selectedRequest.requester_email && (
                    <p className="text-xs text-blue-600 mt-0.5">
                      {selectedRequest.requester_email}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                    Status
                  </label>
                  {getStatusBadge(selectedRequest.status)}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                    Document Type
                  </label>
                  <p className="font-medium text-gray-700">
                    {selectedRequest.document_type}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                    Requested On
                  </label>
                  <p className="text-sm text-gray-600">
                    {new Date(selectedRequest.created_at).toLocaleString(
                      "en-GB",
                    )}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                  Reason / Purpose
                </label>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm text-gray-700 leading-relaxed italic">
                  &ldquo;{selectedRequest.reason}&rdquo;
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6 space-y-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Settings size={16} className="text-[#F2924E]" />{" "}
                  Administrative Actions
                </h3>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-2">
                    Quick Status Update
                  </label>
                  <select
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F2924E]/30"
                    value={selectedRequest.status}
                    onChange={(e) =>
                      handleUpdateStatus(selectedRequest.id, e.target.value)
                    }
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>

                <div className="p-5 bg-orange-50/60 border border-orange-100 rounded-2xl space-y-4">
                  <h4 className="text-xs font-bold text-orange-800 uppercase tracking-wider flex items-center gap-2">
                    <FileCheck2 size={14} /> Automated Document Generation
                  </h4>
                  <select
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#F2924E]/30"
                    value={selectedTemplateId}
                    onChange={(e) =>
                      setSelectedTemplateId(e.target.value as any)
                    }
                  >
                    <option value="">Select template…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.template_type})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleGenerateDocument(selectedRequest.id)}
                    disabled={!selectedTemplateId || loading}
                    className="w-full bg-[#F2924E] text-white py-2.5 rounded-xl text-sm font-bold hover:bg-[#e4833f] transition disabled:opacity-50 shadow-sm"
                  >
                    Generate PDF &amp; Complete Request
                  </button>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <Mail size={14} /> Custom Letter
                  </h4>
                  <textarea
                    value={customLetterText}
                    onChange={(e) => setCustomLetterText(e.target.value)}
                    placeholder="Write a custom response or letter…"
                    className="w-full p-4 border border-gray-200 rounded-2xl text-sm min-h-[140px] outline-none focus:ring-2 focus:ring-[#F2924E]/30 focus:border-[#F2924E] transition resize-none"
                  />
                  <button
                    onClick={() => handleSendCustomLetter(selectedRequest.id)}
                    disabled={!customLetterText.trim() || loading}
                    className="w-full bg-gray-900 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-black transition disabled:opacity-50"
                  >
                    Generate Custom PDF &amp; Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HR: Full-Screen Document Approval Modal */}
      {selectedApprovalDoc && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-[1100px] max-h-[95vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center px-8 py-6 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#F2924E] text-white rounded-2xl flex items-center justify-center text-lg font-bold shadow-sm">
                  {(selectedApprovalDoc.employee_name || "?")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <h2 className="text-[18px] font-bold text-gray-900 leading-snug">
                    {selectedApprovalDoc.employee_name ||
                      `Employee ${selectedApprovalDoc.employee_id}`}
                  </h2>
                  <p className="text-[13px] text-gray-500 font-medium">
                    {selectedApprovalDoc.document_type}
                    {" \u2022 "}
                    Submitted{" "}
                    {new Date(
                      selectedApprovalDoc.uploaded_at,
                    ).toLocaleDateString("en-GB")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedApprovalDoc(null);
                  setApprovalRejectMode(false);
                  setApprovalError("");
                }}
                className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-gray-400 hover:text-gray-900 transition-all border border-transparent hover:border-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-white space-y-6">
              {/* Document Preview iframe */}
              <div className="relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-gray-200 to-gray-100 rounded-[2rem] blur opacity-30" />
                <div className="relative bg-white border border-gray-200 rounded-[1.8rem] overflow-hidden shadow-sm h-[500px]">
                  {selectedApprovalDoc.file_path ? (
                    <iframe
                      src={`http://localhost:8000/${selectedApprovalDoc.file_path}`}
                      className="w-full h-full border-none"
                      title="Document Preview"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-3">
                      <FileText size={44} className="opacity-20" />
                      <p className="text-sm">
                        Preview not available for this document
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Box */}
              {!approvalRejectMode ? (
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#F2924E] rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-gray-900 mb-1">
                      Pending Review
                    </h3>
                    <p className="text-[13px] text-gray-600 font-medium leading-relaxed">
                      Carefully review the document above. Verify all
                      information is correct and the document is legible before
                      proceeding with approval.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm">
                      <XCircle size={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-[14px] font-bold text-gray-900 mb-1">
                        Rejecting Document
                      </h3>
                      <p className="text-[13px] text-gray-600 font-medium mb-4">
                        Please provide a clear reason. This will be shared with
                        the employee so they can correct and re-upload.
                      </p>
                      <textarea
                        placeholder="e.g., The document is blurred, or the name does not match our records."
                        value={approvalRejectReason}
                        onChange={(e) => {
                          setApprovalRejectReason(e.target.value);
                          setApprovalError("");
                        }}
                        className="w-full border border-red-200 rounded-xl p-4 text-[13px] font-medium text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300 bg-white h-32"
                      />
                    </div>
                  </div>
                </div>
              )}

              {approvalError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl p-4 text-[13px] font-bold">
                  <AlertCircle size={16} /> {approvalError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-gray-100 bg-gray-50/50 flex gap-4">
              {!approvalRejectMode ? (
                <>
                  <button
                    disabled={approvalLoading}
                    onClick={handleApproveDocModal}
                    className="flex-1 bg-[#F2924E] hover:bg-[#e07d3a] text-white py-4 rounded-2xl font-bold text-[14px] transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {approvalLoading ? (
                      "Approving…"
                    ) : (
                      <>
                        <CheckCircle size={18} /> Approve Document
                      </>
                    )}
                  </button>
                  <button
                    disabled={approvalLoading}
                    onClick={() => setApprovalRejectMode(true)}
                    className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-4 rounded-2xl font-bold text-[14px] transition-all flex items-center justify-center gap-2"
                  >
                    <XCircle size={18} /> Reject Document
                  </button>
                </>
              ) : (
                <>
                  <button
                    disabled={approvalLoading || !approvalRejectReason.trim()}
                    onClick={handleRejectDocModal}
                    className="flex-[2] bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-bold text-[14px] transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {approvalLoading ? "Submitting…" : "Submit Rejection"}
                  </button>
                  <button
                    disabled={approvalLoading}
                    onClick={() => {
                      setApprovalRejectMode(false);
                      setApprovalError("");
                    }}
                    className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-4 rounded-2xl font-bold text-[14px] transition-all"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HR: Create Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">
                Create New Template
              </h3>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateTemplate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Name
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#F2924E]/30 focus:border-[#F2924E] transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Category
                  </label>
                  <input
                    type="text"
                    value={templateCategory}
                    onChange={(e) => setTemplateCategory(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#F2924E]/30 focus:border-[#F2924E] transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Type
                </label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={templateType === "HTML"}
                      onChange={() => setTemplateType("HTML")}
                      className="accent-[#F2924E]"
                    />
                    HTML Content
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={templateType === "DOCX"}
                      onChange={() => setTemplateType("DOCX")}
                      className="accent-[#F2924E]"
                    />
                    Upload DOCX
                  </label>
                </div>
              </div>
              {templateType === "HTML" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    HTML Content
                  </label>
                  <textarea
                    value={templateContent}
                    onChange={(e) => setTemplateContent(e.target.value)}
                    placeholder="<div>Dear {{employee_name}},</div>"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm min-h-[160px] font-mono outline-none focus:ring-2 focus:ring-[#F2924E]/30 focus:border-[#F2924E] transition resize-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    DOCX File
                  </label>
                  <input
                    type="file"
                    accept=".docx"
                    onChange={(e) =>
                      setTemplateFile(e.target.files?.[0] || null)
                    }
                    className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-50 file:text-[#F2924E] file:font-semibold hover:file:bg-orange-100 transition"
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#F2924E] text-white py-2.5 rounded-xl font-bold hover:bg-[#e4833f] transition disabled:opacity-50 shadow-sm"
              >
                {loading ? "Creating…" : "Save Template"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* HR: Template Preview Modal */}
      {previewTemplate && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => {
            setPreviewTemplate(null);
            setPreviewHtml(null);
          }}
        >
          <div
            className="bg-white w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="bg-[#F2924E]/10 p-2.5 rounded-xl">
                  <FileCode size={18} className="text-[#F2924E]" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">
                    {previewTemplate.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {previewTemplate.category} &nbsp;·&nbsp;
                    <span
                      className={`font-semibold ${previewTemplate.template_type === "HTML" ? "text-blue-600" : "text-purple-600"}`}
                    >
                      {previewTemplate.template_type}
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPreviewTemplate(null);
                  setPreviewHtml(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-400 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/40">
              {previewLoading ? (
                <div className="flex items-center justify-center h-52 gap-3">
                  <div className="w-7 h-7 border-2 border-[#F2924E] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-gray-500">
                    Loading preview…
                  </span>
                </div>
              ) : previewHtml ? (
                <div
                  className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm prose prose-sm max-w-none text-gray-800 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-52 text-gray-400 gap-3">
                  <FileText size={40} className="opacity-20" />
                  <p className="text-sm">
                    No preview available for this template.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${previewTemplate.template_type === "HTML" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}
              >
                {previewTemplate.template_type} Template
              </span>
              <button
                onClick={() => {
                  setPreviewTemplate(null);
                  setPreviewHtml(null);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HR: Add Document Type Modal */}
      {showTypeModal && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">
                Add Document Type
              </h3>
              <button
                onClick={() => setShowTypeModal(false)}
                className="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateType} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  required
                  placeholder="e.g. NIC, Degree Certificate"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#F2924E]/30 focus:border-[#F2924E] transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description
                </label>
                <textarea
                  value={typeDesc}
                  onChange={(e) => setTypeDesc(e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#F2924E]/30 focus:border-[#F2924E] transition resize-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="type-mandatory"
                  checked={typeMandatory}
                  onChange={(e) => setTypeMandatory(e.target.checked)}
                  className="w-4 h-4 accent-[#F2924E]"
                />
                <label
                  htmlFor="type-mandatory"
                  className="text-sm text-gray-700 font-medium cursor-pointer"
                >
                  Mandatory for all employees
                </label>
              </div>
              <button
                type="submit"
                className="w-full bg-[#F2924E] text-white py-2.5 rounded-xl font-bold hover:bg-[#e4833f] transition shadow-sm"
              >
                Save Document Type
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
