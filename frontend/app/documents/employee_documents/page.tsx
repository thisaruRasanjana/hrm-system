"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Eye, FileText, FolderOpen, Users } from "lucide-react";
import DocumentTabs from "../../components/DocumentTabsHR";
import { apiFetch, fileUrl } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

type EmployeeSummary = {
  id: number;
  employee_id?: string;
  first_name: string;
  last_name: string;
  department?: string;
  designation?: string;
  status: string;
  uploaded_count: number;
  request_count: number;
};

type UploadedDocument = {
  id: string;
  document_type: string;
  is_mandatory: boolean;
  file_name: string;
  file_url?: string;
  status: string;
  uploaded_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
};

type RequestedDocument = {
  id: string;
  document_type: string;
  reason: string;
  status: string;
  source: string;
  created_at: string;
  rejection_reason?: string;
  generated_document_url?: string;
};

type EmployeeDetail = {
  employee: EmployeeSummary;
  uploaded_documents: UploadedDocument[];
  requested_documents: RequestedDocument[];
};

const DOC_BADGES: Record<string, { label: string; cls: string }> = {
  UPLOADED: { label: "Uploaded", cls: "bg-blue-100 text-blue-600" },
  PENDING_REVIEW: { label: "Pending Review", cls: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "Approved", cls: "bg-green-100 text-green-600" },
  REJECTED: { label: "Rejected", cls: "bg-red-100 text-red-600" },
  PENDING: { label: "Pending", cls: "bg-yellow-100 text-yellow-700" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-blue-100 text-blue-600" },
  COMPLETED: { label: "Completed", cls: "bg-green-100 text-green-600" },
};

function Badge({ status }: { status: string }) {
  const b = DOC_BADGES[status] || { label: status, cls: "bg-gray-100 text-gray-500" };
  return <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${b.cls}`}>{b.label}</span>;
}

function getInitials(first: string, last: string) {
  return `${(first?.[0] || "").toUpperCase()}${(last?.[0] || "").toUpperCase()}`;
}

export default function EmployeeDocumentsPage() {
  const { user, hasPermission } = useAuth();
  const [statusTab, setStatusTab] = useState<"active" | "inactive">("active");
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!user || !hasPermission("document:view_employee_docs")) return;
    setLoading(true);
    apiFetch(`/documents/employees/?status_filter=${statusTab}`)
      .then((r) => r.json())
      .then((data) => setEmployees(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error fetching employees:", err))
      .finally(() => setLoading(false));
  }, [user, statusTab]);

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return employees.filter((emp) => {
      if (!q) return true;
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
      return fullName.includes(q) || (emp.employee_id?.toLowerCase() || "").includes(q);
    });
  }, [employees, searchQuery]);

  async function openEmployee(emp: EmployeeSummary) {
    setDetailLoading(true);
    try {
      const res = await apiFetch(`/documents/employees/${emp.id}/documents`);
      if (!res.ok) throw new Error(`Failed to load documents (${res.status})`);
      setDetail(await res.json());
    } catch (err) {
      console.error("Error fetching employee documents:", err);
    } finally {
      setDetailLoading(false);
    }
  }

  async function downloadDocument(doc: UploadedDocument) {
    try {
      const res = await apiFetch(`/documents/employees/download/${doc.id}`);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name || "document";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading document:", err);
    }
  }

  if (user && !hasPermission("document:view_employee_docs")) {
    return (
      <div className="space-y-6 w-full">
        <DocumentTabs />
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
          You don't have permission to view employee documents.
        </div>
      </div>
    );
  }

  /* ─────────────── Detail view for one employee ─────────────── */
  if (detail) {
    const emp = detail.employee;
    return (
      <div className="space-y-6 w-full">
        <DocumentTabs />

        <div>
          <button
            onClick={() => setDetail(null)}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-3 font-medium"
          >
            <ArrowLeft size={16} /> Back to employee list
          </button>
        </div>

        {/* Employee header */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-6 flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-[#f08a4b] to-[#d66f1b] text-white rounded-2xl flex items-center justify-center text-lg font-bold shadow-sm flex-shrink-0">
            {getInitials(emp.first_name, emp.last_name)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">{emp.first_name} {emp.last_name}</h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                emp.status === "active"
                  ? "bg-[#EE7F22]/10 text-[#EE7F22] border border-[#F9A15D]/40"
                  : "bg-gray-100 text-gray-500 border border-gray-200"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${emp.status === "active" ? "bg-[#EE7F22]" : "bg-gray-400"}`} />
                {emp.status === "active" ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {emp.employee_id}{emp.designation ? ` · ${emp.designation}` : ""}{emp.department ? ` · ${emp.department}` : ""}
            </p>
          </div>
        </div>

        {/* Uploaded documents */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <FolderOpen size={18} className="text-[#EE7F22]" />
            <h2 className="font-semibold">Uploaded Documents</h2>
            <span className="text-xs text-gray-400 font-medium">({detail.uploaded_documents.length})</span>
          </div>
          {detail.uploaded_documents.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-gray-400">No documents uploaded by this employee.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {detail.uploaded_documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between px-6 py-4 gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">
                      {doc.document_type}
                      {doc.is_mandatory && (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">Mandatory</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{doc.file_name}</p>
                    <p className="text-xs text-gray-400">
                      Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                    {doc.status === "REJECTED" && doc.rejection_reason && (
                      <p className="text-xs text-red-500 mt-1">Rejected: {doc.rejection_reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge status={doc.status} />
                    {doc.file_url && (
                      <a
                        href={fileUrl(doc.file_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:border-[#EE7F22] hover:text-[#EE7F22] transition-colors"
                      >
                        <Eye size={14} /> View
                      </a>
                    )}
                    <button
                      onClick={() => downloadDocument(doc)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#EE7F22] hover:bg-[#d66f1b] transition-colors"
                    >
                      <Download size={14} /> Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Requested documents */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <FileText size={18} className="text-[#EE7F22]" />
            <h2 className="font-semibold">Requested Documents</h2>
            <span className="text-xs text-gray-400 font-medium">({detail.requested_documents.length})</span>
          </div>
          {detail.requested_documents.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-gray-400">No document requests from this employee.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {detail.requested_documents.map((req) => (
                <div key={req.id} className="flex items-center justify-between px-6 py-4 gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{req.document_type}</p>
                    <p className="text-xs text-gray-500 truncate">{req.reason}</p>
                    <p className="text-xs text-gray-400">
                      Requested {new Date(req.created_at).toLocaleDateString()}
                    </p>
                    {req.status === "REJECTED" && req.rejection_reason && (
                      <p className="text-xs text-red-500 mt-1">Rejected: {req.rejection_reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge status={req.status} />
                    {req.generated_document_url && (
                      <a
                        href={fileUrl(req.generated_document_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:border-[#EE7F22] hover:text-[#EE7F22] transition-colors"
                      >
                        <Eye size={14} /> View Document
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─────────────── Employee list view ─────────────── */
  return (
    <div className="space-y-6 w-full">
      <DocumentTabs />

      <div>
        <h1 className="text-2xl font-semibold">Employee Documents</h1>
        <p className="text-gray-500 text-sm">
          Browse uploaded and requested documents of active and inactive employees
        </p>
      </div>

      {/* Active / Inactive toggle + search */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex bg-gray-50/80 p-1 rounded-xl border border-gray-100">
          {(["active", "inactive"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 border ${
                statusTab === tab
                  ? "bg-white shadow-sm border-gray-100 " + (tab === "active" ? "text-[#f08a4b]" : "text-gray-800")
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-white/50"
              }`}
            >
              {tab === "active" ? "Active Employees" : "Inactive Employees"}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[250px]">
          <input
            placeholder="Search by name or employee ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#f08a4b]/20 focus:border-[#f08a4b] bg-white transition"
          />
        </div>
      </div>

      {/* Employee list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-40 text-sm text-gray-400">Loading employees...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14">
            <Users size={28} className="text-gray-300" />
            <p className="text-sm font-medium text-gray-500">No {statusTab} employees found</p>
            <p className="text-xs text-gray-400">Try adjusting your search</p>
          </div>
        ) : (
          filteredEmployees.map((emp) => (
            <div key={emp.id} className="flex items-center justify-between px-6 py-4 hover:bg-orange-50/30 transition-colors">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 bg-gradient-to-br from-[#f08a4b] to-[#d66f1b] text-white rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm">
                  {getInitials(emp.first_name, emp.last_name)}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{emp.first_name} {emp.last_name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {emp.employee_id}{emp.designation ? ` · ${emp.designation}` : ""}{emp.department ? ` · ${emp.department}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">{emp.uploaded_count}</span> uploaded
                  </p>
                  <p className="text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">{emp.request_count}</span> requested
                  </p>
                </div>
                <button
                  onClick={() => openEmployee(emp)}
                  disabled={detailLoading}
                  className="bg-[#f08a4b] hover:bg-[#e07a3b] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 shadow-sm shadow-orange-100 flex items-center gap-2"
                >
                  View Documents
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
