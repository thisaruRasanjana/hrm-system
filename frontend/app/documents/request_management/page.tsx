"use client";

import { useEffect, useState } from "react";
import DocumentTabsHR from "../../components/DocumentTabsHR";
import { Search, Clock, FileText, CheckCircle, XCircle, ArrowLeft, AlertCircle, User, Mail, Calendar, Download } from "lucide-react";
import GenerateDocumentModal from "../../components/GenerateDocumentModal";
import RejectRequestModal from "../../components/RejectRequestModal";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

type RequestType = {
  id: string;
  employee_id: string;
  employee_name?: string;
  document_type: string;
  reason: string;
  status: string;
  source: string;
  requester_email: string | null;
  requester_message: string | null;
  rejection_reason: string | null;
  generated_document_path: string | null;
  created_at: string;
};

export default function HRRequestManagementPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"ALL" | "NEW" | "IN_PROGRESS" | "COMPLETED">("NEW");
  const [requests, setRequests] = useState<RequestType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedRequest, setSelectedRequest] = useState<RequestType | null>(null);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Employee picker for assigning the correct subject employee to an external request
  type EmployeeOption = { id: number; first_name: string; last_name: string; designation?: string | null };
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [assigning, setAssigning] = useState(false);

  const isExternal = (r: RequestType | null) => (r?.source ?? "INTERNAL") === "EXTERNAL";

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/hr-document-requests/");
      const json = await res.json();
      const data = json?.data ?? json;
      const safeData_raw = data;
      const safeData = Array.isArray(safeData_raw) ? safeData_raw : [];
      setRequests(safeData);

      if (selectedRequest) {
        const upToDate = safeData.find((r: RequestType) => r.id === selectedRequest.id);
        if (upToDate) setSelectedRequest(upToDate);
      }
    } catch (err) {
      console.error("Failed to fetch requests", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchRequests();
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Load the active employee list once, to power the external-request assignment picker
  useEffect(() => {
    if (!user) return;
    apiFetch("/employees/panel-options")
      .then((res) => res.json())
      .then((data) => setEmployees(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Failed to load employees", err));
  }, [user]);

  const handleAssignEmployee = async (requestId: string, employeeId: string) => {
    if (!employeeId) return;
    setAssigning(true);
    try {
      const res = await apiFetch(
        `/hr-document-requests/${requestId}/assign-employee?employee_id=${employeeId}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Assign failed");
      await fetchRequests();
    } catch (err) {
      console.error("Failed to assign employee", err);
      alert("Failed to assign employee to this request.");
    } finally {
      setAssigning(false);
    }
  };

  const handleMarkInProgress = async (id: string) => {
    try {
      await apiFetch(`/hr-document-requests/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      fetchRequests();
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const handleForceDownload = async (path: string) => {
    try {
      const response = await apiFetch(`/${path}`);
      if (!response.ok) throw new Error("File not found");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = path.split("/").pop() || "document.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed", err);
      alert("Failed to download document.");
    }
  };

  const newRequests = requests.filter(r => r.status === "PENDING" || r.status === "NEW");
  const inProgressRequests = requests.filter(r => r.status === "IN_PROGRESS");
  const completedRequests = requests.filter(r => r.status === "COMPLETED" || r.status === "REJECTED");

  const displayedRequests = (
    activeTab === "ALL" ? requests :
      activeTab === "NEW" ? newRequests :
        activeTab === "IN_PROGRESS" ? inProgressRequests :
          completedRequests
  ).filter(r =>
    (r.employee_id && r.employee_id.toString().includes(searchQuery)) ||
    (r.document_type && r.document_type.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (r.requester_email && r.requester_email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 flex flex-col h-full min-h-[calc(100vh-80px)]">
      <DocumentTabsHR />

      {!selectedRequest ? (
        <div className="animate-in fade-in flex-1">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Request Management</h1>
            <p className="text-sm text-gray-500">
              Review and respond to employee document requests
            </p>
          </div>

          <div className="flex gap-4 mb-8">
            <div
              onClick={() => setActiveTab("NEW")}
              className={`flex-1 p-5 rounded-2xl bg-white border border-gray-100 flex items-center justify-between cursor-pointer transition-all ${activeTab === "NEW" ? "ring-1 ring-[#F2924E] shadow-lg" : "shadow-sm hover:shadow-md"
                }`}
            >
              <div>
                <p className="text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-1">New Requests</p>
                <p className="text-3xl font-bold text-gray-900">{newRequests.length}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${activeTab === "NEW" ? "bg-orange-100 text-[#F2924E]" : "bg-orange-50/50 text-[#F2924E]/70"
                }`}>
                <FileText size={24} />
              </div>
            </div>

            <div
              onClick={() => setActiveTab("IN_PROGRESS")}
              className={`flex-1 p-5 rounded-2xl bg-white border border-gray-100 flex items-center justify-between cursor-pointer transition-all ${activeTab === "IN_PROGRESS" ? "ring-1 ring-gray-800 shadow-lg" : "shadow-sm hover:shadow-md"
                }`}
            >
              <div>
                <p className="text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-1">In Progress</p>
                <p className="text-3xl font-bold text-gray-900">{inProgressRequests.length}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${activeTab === "IN_PROGRESS" ? "bg-gray-100 text-gray-800" : "bg-gray-50 text-gray-400"
                }`}>
                <Clock size={24} />
              </div>
            </div>

            <div
              onClick={() => setActiveTab("COMPLETED")}
              className={`flex-1 p-5 rounded-2xl bg-white border border-gray-100 flex items-center justify-between cursor-pointer transition-all ${activeTab === "COMPLETED" ? "ring-1 ring-gray-800 shadow-lg" : "shadow-sm hover:shadow-md"
                }`}
            >
              <div>
                <p className="text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-1">Completed</p>
                <p className="text-3xl font-bold text-gray-900">{completedRequests.length}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${activeTab === "COMPLETED" ? "bg-gray-100 text-gray-800" : "bg-gray-50 text-gray-400"
                }`}>
                <CheckCircle size={24} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by ID or document type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F2924E]/30 transition shadow-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {loading ? (
              <div className="bg-white border border-gray-100 text-gray-400 text-sm p-16 text-center rounded-2xl shadow-sm">
                Loading requests...
              </div>
            ) : displayedRequests.length === 0 ? (
              <div className="bg-white border border-gray-100 text-gray-400 text-sm p-16 text-center rounded-2xl shadow-sm">
                No requests found.
              </div>
            ) : (
              displayedRequests.map(req => {
                const isNew = req.status === "PENDING" || req.status === "NEW";
                const dateRequested = new Date(req.created_at);

                return (
                  <div
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className="bg-white border border-gray-100 rounded-2xl p-6 flex items-center justify-between cursor-pointer shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex gap-4 items-start">
                      <div className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${isNew ? 'bg-[#F2924E]' : 'bg-transparent'}`} />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900 text-[15px]">
                            {isExternal(req)
                              ? (req.requester_email || "External Requester")
                              : `Employee ID: ${req.employee_id}`}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-2.5 tracking-tight">{req.document_type}</p>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${isNew ? "bg-[#F2924E] text-white" : "bg-gray-100 text-gray-600 border border-gray-200"
                            }`}>
                            {req.status}
                          </span>
                          {isExternal(req) && (
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1">
                              <Mail size={10} /> External
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                      <Clock size={14} />
                      <span className="text-[12px] font-medium">{dateRequested.toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-right-4 flex-1">
          <button
            onClick={() => setSelectedRequest(null)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-[13px] font-semibold mb-6 transition"
          >
            <ArrowLeft size={16} /> Back to Queue
          </button>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2.5 tracking-tight">
              {selectedRequest.document_type}
            </h1>
            <div className="flex items-center gap-3 text-sm">
              <span className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-wider font-bold ${selectedRequest.status === 'PENDING' ? 'bg-[#F2924E]/10 text-[#F2924E]' : 'bg-gray-100 text-gray-700'}`}>
                {selectedRequest.status}
              </span>
              {isExternal(selectedRequest) && (
                <span className="px-3 py-1 rounded-full text-[11px] uppercase tracking-wider font-bold bg-purple-100 text-purple-700 flex items-center gap-1.5">
                  <Mail size={12} /> External Request
                </span>
              )}
            </div>
          </div>

          {isExternal(selectedRequest) ? (
            <div className="bg-white shadow-md border border-purple-100 rounded-2xl p-8 mb-4">
              <h3 className="text-[13px] font-bold text-gray-900 mb-6 tracking-wide flex items-center gap-2">
                <Mail size={14} className="text-purple-600" /> External Email Request
              </h3>

              <div className="flex mb-6">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">FROM (REQUESTER)</p>
                  <p className="font-bold text-gray-800">{selectedRequest.requester_email || "Unknown"}</p>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">SUBJECT</p>
                  <p className="font-bold text-gray-800">{selectedRequest.reason}</p>
                </div>
              </div>

              {/* The full email body so HR can read who/what the request is about */}
              <div className="mb-6">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">EMAIL CONTENT</p>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {selectedRequest.requester_message?.trim() || "No email body was captured for this request."}
                </div>
              </div>

              {/* Assign the actual subject employee (the person the letter is about) */}
              <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-4">
                <p className="text-[10px] font-bold text-purple-700 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <User size={12} /> SUBJECT EMPLOYEE
                </p>
                {selectedRequest.employee_id ? (
                  <p className="text-[13px] font-bold text-gray-800 mb-3">
                    Assigned: {selectedRequest.employee_name} (ID {selectedRequest.employee_id})
                  </p>
                ) : (
                  <p className="text-[13px] text-purple-700 font-medium mb-3 flex items-center gap-1.5">
                    <AlertCircle size={13} /> No employee assigned yet — pick the employee this letter is about before generating.
                  </p>
                )}
                <select
                  value={selectedRequest.employee_id || ""}
                  disabled={assigning}
                  onChange={(e) => handleAssignEmployee(selectedRequest.id, e.target.value)}
                  className="w-full bg-white border border-purple-200 rounded-lg px-4 py-2.5 text-[13px] font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300 transition disabled:opacity-60"
                >
                  <option value="">{assigning ? "Assigning..." : "Select an employee..."}</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}{emp.designation ? ` — ${emp.designation}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow-md border border-gray-100 rounded-2xl p-8 mb-4">
              <h3 className="text-[13px] font-bold text-gray-900 mb-6 tracking-wide">Requester Information</h3>
              <div className="flex">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">EMPLOYEE ID</p>
                  <p className="font-bold text-gray-800">{selectedRequest.employee_id}</p>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">NAME</p>
                  <p className="font-bold text-gray-800">{selectedRequest.employee_name || "N/A"}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white shadow-md border border-gray-100 rounded-2xl p-8 mb-6">
            <h3 className="text-[13px] font-bold text-gray-900 mb-6 tracking-wide">Request Details</h3>
            <div className="mb-8">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">REASON</p>
              <p className="text-[15px] text-gray-800 leading-relaxed font-medium">
                {selectedRequest.reason}
              </p>
            </div>
            <div className="flex items-start">
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <FileText size={12} /> DOCUMENT TYPE
                </p>
                <p className="font-bold text-gray-900 text-[15px]">{selectedRequest.document_type}</p>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Calendar size={12} /> REQUESTED DATE
                </p>
                <p className="font-bold text-gray-900 text-[15px]">
                  {new Date(selectedRequest.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow-md border border-gray-100 rounded-2xl p-8 mb-8">
            <h3 className="text-[13px] font-bold text-gray-900 mb-5 tracking-wide">Actions</h3>
            <div className="flex flex-col gap-4 w-full">
              <div className="flex flex-row gap-2 items-center">
                {(selectedRequest.status === 'PENDING' || selectedRequest.status === 'NEW') && (
                  <button
                    onClick={() => handleMarkInProgress(selectedRequest.id)}
                    className="flex-1 bg-orange-50 hover:bg-orange-100 text-[#F2924E] border border-orange-100 py-2.5 text-sm rounded-lg transition shadow-sm font-bold flex items-center justify-center"
                  >
                    Mark In Progress
                  </button>
                )}
                {(selectedRequest.status === 'PENDING' || selectedRequest.status === 'NEW' || selectedRequest.status === 'IN_PROGRESS') && (
                  <>
                    <button
                      onClick={() => setShowGenerateModal(true)}
                      className="flex-1 bg-[#F2924E] hover:bg-[#e07d3a] text-white py-2.5 text-sm rounded-lg transition shadow-sm flex items-center justify-center gap-2 font-bold"
                    >
                      <FileText size={14} /> Generate
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 py-2.5 text-sm rounded-lg transition shadow-sm flex items-center justify-center gap-2 font-bold"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </>
                )}
              </div>

              {selectedRequest.status === 'COMPLETED' && selectedRequest.generated_document_path && (
                <div className="flex flex-col gap-3 bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-gray-600" />
                    <span className="text-[13px] font-medium text-gray-700">Document generated successfully.</span>
                  </div>
                  <button
                    onClick={() => handleForceDownload(selectedRequest.generated_document_path!)}
                    className="w-max bg-orange-50 hover:bg-orange-100 text-[#F2924E] text-[12px] font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2 border border-orange-100"
                  >
                    <Download size={14} /> Download Document
                  </button>
                </div>
              )}

              {selectedRequest.status === 'REJECTED' && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Reason for Rejection</p>
                  <p className="text-sm text-gray-700 font-medium">{selectedRequest.rejection_reason || "No reason provided"}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showRejectModal && selectedRequest && (
        <RejectRequestModal
          request={selectedRequest}
          onClose={() => setShowRejectModal(false)}
          onSuccess={() => {
            setShowRejectModal(false);
            fetchRequests();
          }}
        />
      )}

      {showGenerateModal && selectedRequest && (
        <GenerateDocumentModal
          request={selectedRequest}
          onClose={() => setShowGenerateModal(false)}
          onSuccess={() => {
            setShowGenerateModal(false);
            fetchRequests();
          }}
        />
      )}
    </div>
  );
}
