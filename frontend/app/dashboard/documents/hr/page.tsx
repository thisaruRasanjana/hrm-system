"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { 
  FileCheck2, 
  Search, 
  Filter, 
  MoreVertical, 
  Settings, 
  FileCode, 
  Trash2, 
  Check, 
  X, 
  Download, 
  Eye, 
  FileUp, 
  Plus,
  RefreshCw,
  Mail
} from "lucide-react";

// --- Types ---

interface DocumentRequest {
  id: string;
  employee_id: number | null;
  employee_name: string | null;
  document_type: string;
  reason: string;
  status: "PENDING" | "IN_PROGRESS" | "APPROVED" | "COMPLETED" | "REJECTED";
  source: "INTERNAL" | "EXTERNAL";
  requester_email: string | null;
  created_at: string;
  rejection_reason: string | null;
  generated_document_path: string | null;
}

interface PendingDocument {
  id: string;
  employee_id: number;
  document_type: string;
  is_mandatory: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED";
  uploaded_at: string;
  rejection_reason: string | null;
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

// --- Component ---

export default function HRDocumentsPage() {
  const [activeTab, setActiveTab] = useState<"requests" | "approval" | "templates" | "types">("requests");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Data states
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);

  // Filters
  const [requestStatusFilter, setRequestStatusFilter] = useState("All");

  // Selection states
  const [selectedRequest, setSelectedRequest] = useState<DocumentRequest | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null); // document_id
  const [rejectionReason, setRejectionReason] = useState("");

  // Template Modal states
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [templateType, setTemplateType] = useState<"HTML" | "DOCX">("HTML");
  const [templateContent, setTemplateContent] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);

  // Type Modal states
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeName, setTypeName] = useState("");
  const [typeDesc, setTypeDesc] = useState("");
  const [typeMandatory, setTypeMandatory] = useState(false);

  // Detail Panel actions
  const [customLetterText, setCustomLetterText] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "">("");

  useEffect(() => {
    loadTabData();
  }, [activeTab, requestStatusFilter]);

  const loadTabData = () => {
    if (activeTab === "requests") fetchRequests();
    if (activeTab === "approval") fetchPendingDocs();
    if (activeTab === "templates") fetchTemplates();
    if (activeTab === "types") fetchDocTypes();
  };

  // --- API Calls ---

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const statusParam = requestStatusFilter === "All" ? "" : `?status=${requestStatusFilter}`;
      const data = await api.get<DocumentRequest[]>(`/hr-document-requests/${statusParam}`);
      setRequests(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingDocs = async () => {
    setLoading(true);
    try {
      const data = await api.get<PendingDocument[]>("/documents/review/pending");
      setPendingDocs(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch pending documents");
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
      setError(err.message || "Failed to fetch document types");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string, reason?: string) => {
    try {
      await api.put(`/hr-document-requests/${id}/status`, { 
        status, 
        rejection_reason: reason 
      });
      fetchRequests();
      if (selectedRequest?.id === id) {
        setSelectedRequest(prev => prev ? { ...prev, status: status as any, rejection_reason: reason || null } : null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to update status");
    }
  };

  const handleGenerateDocument = async (requestId: string) => {
    if (!selectedTemplateId) return;
    setLoading(true);
    try {
      const res = await api.post<{ document_path: string }>(`/hr-document-requests/${requestId}/generate`, {
        template_id: Number(selectedTemplateId),
        preview: false
      });
      alert(`Document generated: ${res.document_path}`);
      fetchRequests();
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
        content: customLetterText
      });
      setCustomLetterText("");
      alert("Custom letter sent!");
      fetchRequests();
    } catch (err: any) {
      setError(err.message || "Failed to send custom letter");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDoc = async (id: string) => {
    try {
      await api.patch(`/documents/review/${id}/approve`, {});
      fetchPendingDocs();
    } catch (err: any) {
      setError(err.message || "Failed to approve document");
    }
  };

  const handleRejectDoc = async (id: string) => {
    if (!rejectionReason.trim()) return;
    try {
      await api.patch(`/documents/review/${id}/reject`, { reason: rejectionReason });
      setShowRejectModal(null);
      setRejectionReason("");
      fetchPendingDocs();
    } catch (err: any) {
      setError(err.message || "Failed to reject document");
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
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
      if (templateType === "DOCX" && templateFile) formData.append("file", templateFile);

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
        is_mandatory: typeMandatory
      });
      setShowTypeModal(false);
      setTypeName("");
      setTypeDesc("");
      setTypeMandatory(false);
      fetchDocTypes();
    } catch (err: any) {
      setError(err.message || "Failed to create document type");
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
      fetchRequests();
      alert("Synced with external email requests!");
    } catch (err: any) {
      setError(err.message || "Failed to sync emails");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: any = {
      PENDING: "bg-yellow-100 text-yellow-700",
      IN_PROGRESS: "bg-blue-100 text-blue-700",
      APPROVED: "bg-teal-100 text-teal-700",
      COMPLETED: "bg-green-100 text-green-700",
      REJECTED: "bg-red-100 text-red-700",
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-700"}`}>
        {status}
      </span>
    );
  };

  // --- Render Sections ---

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-orange-500 rounded-lg">
            <FileCheck2 size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">HR Document Administration</h1>
            <p className="text-gray-500 text-sm">Manage employee requests, verify uploads, and manage document templates.</p>
          </div>
        </div>
        {activeTab === "requests" && (
          <button 
            onClick={handleSyncEmails}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Sync External Requests
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto no-scrollbar">
        {[
          { id: "requests", label: "All Requests" },
          { id: "approval", label: "Pending Approval" },
          { id: "templates", label: "Templates" },
          { id: "types", label: "Document Types" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.id ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError("")}><X size={16} /></button>
        </div>
      )}

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {activeTab === "requests" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <Filter size={18} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-600">Filter Status:</span>
                <select 
                  value={requestStatusFilter} 
                  onChange={(e) => setRequestStatusFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-orange-500"
                >
                  <option value="All">All Requests</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search by employee name..." 
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64 outline-none focus:ring-1 focus:ring-orange-500 transition"
                />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Employee</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Document</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Source</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading && requests.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">Loading...</td></tr>
                  ) : requests.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">No requests matching criteria</td></tr>
                  ) : (
                    requests.map(req => (
                      <tr key={req.id} className="hover:bg-gray-50 transition text-sm">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{req.employee_name || "N/A"}</div>
                          {req.requester_email && <div className="text-xs text-gray-500">{req.requester_email}</div>}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-700">{req.document_type}</td>
                        <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-0.5 rounded ${req.source === "EXTERNAL" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"}`}>
                            {req.source}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500">{new Date(req.created_at).toLocaleDateString("en-GB")}</td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => {
                              setSelectedRequest(req);
                              fetchTemplates(); // Ensure templates are loaded
                            }}
                            className="flex items-center gap-1.5 text-orange-600 font-medium hover:underline"
                          >
                            <Eye size={16} />
                            View / Process
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

        {activeTab === "approval" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-semibold text-gray-500 uppercase">Employee ID</th>
                  <th className="px-6 py-3 font-semibold text-gray-500 uppercase">Document Type</th>
                  <th className="px-6 py-3 font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pendingDocs.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">No documents pending approval</td></tr>
                ) : (
                  pendingDocs.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-medium text-gray-900">{doc.employee_id}</td>
                      <td className="px-6 py-4">{doc.document_type} {doc.is_mandatory && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded ml-1 font-bold">MANDATORY</span>}</td>
                      <td className="px-6 py-4 text-gray-500">{new Date(doc.uploaded_at).toLocaleDateString("en-GB")}</td>
                      <td className="px-6 py-4 flex gap-3">
                        <button onClick={() => handleApproveDoc(doc.id)} className="text-green-600 hover:text-green-800 font-medium flex items-center gap-1"><Check size={16} /> Approve</button>
                        <button onClick={() => setShowRejectModal(doc.id)} className="text-red-600 hover:text-red-800 font-medium flex items-center gap-1"><X size={16} /> Reject</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "templates" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button 
                onClick={() => setShowTemplateModal(true)}
                className="flex items-center gap-2 bg-[#F2924E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#e4833f] transition"
              >
                <Plus size={16} />
                Create Template
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.length === 0 ? (
                <div className="col-span-full p-12 text-center text-gray-400 italic">No templates created yet</div>
              ) : (
                templates.map(tmp => (
                  <div key={tmp.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-orange-50 text-orange-500 rounded-lg"><FileCode size={20} /></div>
                      <button onClick={() => handleDeleteTemplate(tmp.id)} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={18} /></button>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1">{tmp.name}</h3>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 uppercase tracking-tight">{tmp.category}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tight ${tmp.template_type === "HTML" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                        {tmp.template_type}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">Created: {new Date(tmp.created_at).toLocaleDateString("en-GB")}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "types" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button 
                onClick={() => setShowTypeModal(true)}
                className="flex items-center gap-2 bg-[#F2924E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#e4833f] transition"
              >
                <Plus size={16} />
                Add Type
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 font-semibold text-gray-500 uppercase">Description</th>
                    <th className="px-6 py-3 font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 font-semibold text-gray-500 uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {docTypes.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">No document types defined</td></tr>
                  ) : (
                    docTypes.map(type => (
                      <tr key={type.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 font-medium text-gray-900">{type.name} {type.is_mandatory && <span className="ml-2 text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase">Mandatory</span>}</td>
                        <td className="px-6 py-4 text-gray-500">{type.description || "—"}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${type.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                            {type.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => toggleTypeActive(type.id, type.is_active)} className="text-gray-500 hover:text-orange-500 transition mr-4 font-medium">{type.is_active ? "Deactivate" : "Activate"}</button>
                          <button className="text-gray-300 hover:text-red-500 transition"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* --- Modals & Detail Panels --- */}

      {/* Request Detail Drawer */}
      {selectedRequest && (
        <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px] transition-all overflow-hidden flex justify-end">
          <div className="w-full max-w-xl bg-white h-screen shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Request Details</h2>
                <p className="text-xs text-gray-500 uppercase font-medium tracking-wider">{selectedRequest.id}</p>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-gray-200 rounded-lg transition"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-10">
              {/* Core Info */}
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Employee</label>
                  <p className="font-semibold text-gray-900">{selectedRequest.employee_name || "External Requester"}</p>
                  {selectedRequest.requester_email && <p className="text-xs text-blue-600">{selectedRequest.requester_email}</p>}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Status</label>
                  <div>{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Document Type</label>
                  <p className="font-medium text-gray-700">{selectedRequest.document_type}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Requested On</label>
                  <p className="text-sm text-gray-600">{new Date(selectedRequest.created_at).toLocaleString("en-GB")}</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Reason / Purpose</label>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm text-gray-700 leading-relaxed italic">
                  "{selectedRequest.reason}"
                </div>
              </div>

              <div className="border-t border-gray-100 pt-8 space-y-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2"><Settings size={18} className="text-orange-500" /> Administrative Actions</h3>
                
                {/* Status Update */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-gray-600">Quick Status Update</label>
                  <div className="flex gap-3">
                    <select 
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500"
                      value={selectedRequest.status}
                      onChange={(e) => handleUpdateStatus(selectedRequest.id, e.target.value)}
                    >
                      <option value="PENDING">Pending</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </div>
                </div>

                {/* Generate Section */}
                <div className="p-4 bg-orange-50/50 border border-orange-100 rounded-xl space-y-4">
                  <h4 className="text-xs font-bold text-orange-800 uppercase tracking-wider flex items-center gap-2"><FileCheck2 size={16} /> Automated Document Generation</h4>
                  <div className="space-y-3">
                    <select 
                      className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500"
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value as any)}
                    >
                      <option value="">Select template...</option>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.template_type})</option>)}
                    </select>
                    <button 
                      onClick={() => handleGenerateDocument(selectedRequest.id)}
                      disabled={!selectedTemplateId || loading}
                      className="w-full bg-orange-500 text-white py-2 rounded-lg text-sm font-bold hover:bg-orange-600 transition shadow-sm disabled:opacity-50"
                    >
                      Generate PDF & Complete Request
                    </button>
                  </div>
                </div>

                {/* Custom Letter */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2"><Mail size={16} /> Custom Letter / Response</h4>
                  <textarea 
                    value={customLetterText}
                    onChange={(e) => setCustomLetterText(e.target.value)}
                    placeholder="Write a custom response or letter text here..."
                    className="w-full p-4 border border-gray-200 rounded-xl text-sm min-h-[150px] outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <button 
                    onClick={() => handleSendCustomLetter(selectedRequest.id)}
                    disabled={!customLetterText.trim() || loading}
                    className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-bold hover:bg-black transition shadow-sm disabled:opacity-50"
                  >
                    Generate Custom PDF & Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Reject Document</h3>
            <p className="text-sm text-gray-500 mb-4">Please provide a reason for rejecting this document. This will be shown to the employee.</p>
            <textarea 
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm min-h-[100px] mb-4 outline-none focus:ring-1 focus:ring-orange-500"
              placeholder="E.g. Blurred file, wrong document type, expired document..."
            />
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => handleRejectDoc(showRejectModal)} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition">Reject Document</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Create New Template</h3>
              <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-gray-600 transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateTemplate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-orange-500 focus:ring-1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input type="text" value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-orange-500 focus:ring-1" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={templateType === "HTML"} onChange={() => setTemplateType("HTML")} className="text-orange-500 focus:ring-orange-500" /> HTML Content
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={templateType === "DOCX"} onChange={() => setTemplateType("DOCX")} className="text-orange-500 focus:ring-orange-500" /> Upload DOCX
                  </label>
                </div>
              </div>
              {templateType === "HTML" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HTML Content</label>
                  <textarea value={templateContent} onChange={(e) => setTemplateContent(e.target.value)} placeholder="<div>Hello {{name}}</div>" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[150px] font-mono outline-none focus:ring-orange-500 focus:ring-1" />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DOCX File</label>
                  <input type="file" onChange={(e) => setTemplateFile(e.target.files?.[0] || null)} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 transition" />
                </div>
              )}
              <button type="submit" disabled={loading} className="w-full bg-[#F2924E] text-white py-2 rounded-lg font-bold hover:bg-[#e4833f] transition disabled:opacity-50">
                {loading ? "Creating..." : "Save Template"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Document Type Modal */}
      {showTypeModal && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Add Document Type</h3>
              <button onClick={() => setShowTypeModal(false)} className="text-gray-400 hover:text-gray-600 transition"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateType} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={typeName} onChange={(e) => setTypeName(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-orange-500 focus:ring-1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={typeDesc} onChange={(e) => setTypeDesc(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-orange-500 focus:ring-1" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={typeMandatory} onChange={(e) => setTypeMandatory(e.target.checked)} className="rounded text-orange-500 focus:ring-orange-500" />
                <label className="text-sm text-gray-600 font-medium">Is Mandatory for all employees?</label>
              </div>
              <button type="submit" className="w-full bg-[#F2924E] text-white py-2 rounded-lg font-bold hover:bg-[#e4833f] transition">
                Save Document Type
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
