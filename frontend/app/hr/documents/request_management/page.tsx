"use client";

import { useEffect, useState } from "react";
import DocumentTabsHR from "../../../components/DocumentTabsHR";
import { Search, Clock, FileText, CheckCircle, XCircle, ArrowLeft, AlertCircle, User, Mail, Calendar } from "lucide-react";
import GenerateDocumentModal from "../../../components/GenerateDocumentModal";
import RejectRequestModal from "../../../components/RejectRequestModal";

type RequestType = {
  id: string;
  employee_id: string;
  employee_name: string;
  document_type: string;
  purpose: string;
  status: string;
  source: string;
  requester_email: string | null;
  rejection_reason: string | null;
  generated_document_path: string | null;
  created_at: string;
};

export default function HRRequestManagementPage() {
  const [activeTab, setActiveTab] = useState<"ALL" | "NEW" | "IN_PROGRESS" | "COMPLETED">("NEW");
  const [rejectReason, setRejectReason] = useState("");
  const [syncMessage, setSyncMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [requests, setRequests] = useState<RequestType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedRequest, setSelectedRequest] = useState<RequestType | null>(null);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeResults, setEmployeeResults] = useState<{id: string; name: string}[]>([]);
  const [assigningEmployee, setAssigningEmployee] = useState(false);

  const handleForceDownload = async (path: string, e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`http://localhost:8000/${path}`);
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
    }
  };

  const handleSyncEmails = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`http://localhost:8000/hr-document-requests/sync-emails`, { method: "POST" });
      const data = await res.json();
      if (data.status === "success") {
        setSyncMessage({ text: `Synced ${data.processed_emails} new requests.`, type: "success" });
        fetchRequests();
      } else {
        setSyncMessage({ text: `Sync failed: ${data.message || "Unknown error"}`, type: "error" });
      }
    } catch (err) {
      console.error(err);
      setSyncMessage({ text: "Failed to sync emails.", type: "error" });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 4000); // Clear message after 4 seconds
    }
  };

  const searchEmployees = async (query: string) => {
    if (!query.trim()) { setEmployeeResults([]); return; }
    try {
      const res = await fetch(`http://localhost:8000/employees/?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      // Map to a simple {id, name} array
      setEmployeeResults(
        (data || []).slice(0, 6).map((e: {id: string; first_name: string; last_name: string}) => ({
          id: e.id,
          name: `${e.first_name} ${e.last_name}`
        }))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignEmployee = async (employeeId: string, employeeName: string) => {
    if (!selectedRequest) return;
    setAssigningEmployee(true);
    try {
      const res = await fetch(
        `http://localhost:8000/hr-document-requests/${selectedRequest.id}/assign-employee`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employee_id: employeeId })
        }
      );
      const data = await res.json();
      if (data.message) {
        setEmployeeSearch("");
        setEmployeeResults([]);
        fetchRequests();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAssigningEmployee(false);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      // Fetch all requests to calculate total counts for all tabs at once
      const res = await fetch(`http://localhost:8000/hr-document-requests/`);
      const data = await res.json();
      setRequests(data);

      // Update selectedRequest implicitly if it changed status
      setSelectedRequest((prev) => {
        if (!prev) return null;
        const upToDate = data.find((r: RequestType) => r.id === prev.id);
        return upToDate || prev;
      });

    } catch (err) {
      console.error("Failed to fetch requests", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // Auto-refresh every 30s to pick up new external email requests from the background poller
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkInProgress = async (id: string) => {
    try {
      await fetch(`http://localhost:8000/hr-document-requests/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" })
      });
      fetchRequests();
    } catch (err) {
      console.error("Failed to update status", err);
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
    (r.employee_name && r.employee_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (r.document_type && r.document_type.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 flex flex-col h-full min-h-[calc(100vh-80px)]">
      {/* Navigation Tabs */}
      <DocumentTabsHR />

      {/* Main Body Switcher between Queue List and Detail View */}
      {!selectedRequest ? (
        <div className="animate-in fade-in flex-1">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Request Management</h1>
            <p className="text-sm text-gray-500">
              Review and respond to employee and external document requests
            </p>
          </div>

          {/* Top Stat Cards */}
          <div className="flex gap-4 mb-8">
            <div
              onClick={() => setActiveTab("NEW")}
              className={`flex-1 p-5 rounded-2xl bg-white border flex items-center justify-between cursor-pointer transition-all ${activeTab === "NEW" ? "border-[#F2924E] ring-1 ring-[#F2924E] shadow-sm" : "border-gray-200 hover:border-gray-300"
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
              className={`flex-1 p-5 rounded-2xl bg-white border flex items-center justify-between cursor-pointer transition-all ${activeTab === "IN_PROGRESS" ? "border-gray-800 ring-1 ring-gray-800 shadow-sm" : "border-gray-200 hover:border-gray-300"
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
              className={`flex-1 p-5 rounded-2xl bg-white border flex items-center justify-between cursor-pointer transition-all ${activeTab === "COMPLETED" ? "border-gray-800 ring-1 ring-gray-800 shadow-sm" : "border-gray-200 hover:border-gray-300"
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

          {/* Search Bar & Filter */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or document type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F2924E]/50 focus:bg-white transition"
              />
            </div>
            <div className="px-5 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 uppercase tracking-widest">
              {activeTab.replace("_", " ")}
            </div>
            <button
              onClick={() => { setSearchQuery(""); setActiveTab("ALL"); }}
              className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
            >
              Clear
            </button>
            <div className="flex items-center gap-3 ml-auto">
              {syncMessage && (
                <span className={`text-sm font-semibold animate-pulse ${syncMessage.type === "success" ? "text-green-600" : "text-red-500"}`}>
                  {syncMessage.text}
                </span>
              )}
              <button
                onClick={handleSyncEmails}
                disabled={isSyncing}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#F2924E] border border-[#F2924E] rounded-xl hover:opacity-90 transition flex items-center gap-2 disabled:opacity-50"
              >
                <Mail size={16} /> {isSyncing ? "Syncing..." : "Sync Emails"}
              </button>
            </div>
          </div>

          {/* List View */}
          <div className="flex flex-col gap-3">
            {loading ? (
              <div className="bg-white border text-gray-400 text-sm p-16 text-center rounded-2xl">
                Loading requests...
              </div>
            ) : displayedRequests.length === 0 ? (
              <div className="bg-white border text-gray-400 text-sm p-16 text-center rounded-2xl">
                No {activeTab.toLowerCase().replace("_", " ")} requests match your search.
              </div>
            ) : (
              displayedRequests.map(req => {
                const isNew = req.status === "PENDING" || req.status === "NEW";
                const dateRequested = new Date(req.created_at);
                const isToday = dateRequested.toDateString() === new Date().toDateString();

                return (
                  <div
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:border-gray-300 hover:shadow-sm transition"
                  >
                    <div className="flex gap-4 items-start">
                      {/* Active indicator dot */}
                      <div className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${isNew ? 'bg-[#F2924E]' : 'bg-transparent'}`} />

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900 text-[15px]">{req.source === "EXTERNAL" ? req.requester_email : req.employee_name}</h3>
                          {req.source === "EXTERNAL" && (
                            <span className="bg-[#F2924E]/10 text-[#F2924E] text-[9px] uppercase font-bold px-2 py-0.5 rounded tracking-wider">External</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mb-2.5 tracking-tight">{req.document_type}</p>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400 font-medium tracking-wide">Document Type:</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${isNew ? "bg-[#F2924E] text-white" : "bg-gray-100 text-gray-600 border border-gray-200"
                            }`}>
                            {isNew ? 'NEW' : req.status.replace("_", " ")}
                          </span>
                          {isToday && <span className="text-[11px] text-gray-400 font-medium ml-1">Today</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                      <Clock size={14} />
                      <span className="text-[12px] font-medium">{isToday ? "Today" : dateRequested.toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Detail View */
        <div className="animate-in fade-in slide-in-from-right-4 flex-1">
          <button
            onClick={() => setSelectedRequest(null)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-[13px] font-semibold mb-6 transition"
          >
            <ArrowLeft size={16} /> Back to Queue
          </button>

          {/* Detail Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2.5 tracking-tight">
              {selectedRequest.document_type}
            </h1>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 text-gray-500 font-medium text-[13px]">
                <User size={14} className="text-[#F2924E]" /> Employee
              </div>

              <span className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-wider font-bold ${(selectedRequest.status === 'PENDING' || selectedRequest.status === 'NEW')
                ? 'bg-[#F2924E]/10 text-[#F2924E]'
                : 'bg-gray-100 text-gray-700'
                }`}>
                {selectedRequest.status === 'PENDING' ? 'New' : selectedRequest.status.replace("_", " ")}
              </span>
            </div>
          </div>

          {/* Cards */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6.5 mb-4 p-8">
            <h3 className="text-[13px] font-bold text-gray-900 mb-6 tracking-wide">Requester Information</h3>
            <div className="flex">
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{selectedRequest.source === "EXTERNAL" ? "REQUESTER EMAIL" : "NAME"}</p>
                <p className="font-bold text-gray-800 flex items-center gap-2">
                  {selectedRequest.source === "EXTERNAL" ? selectedRequest.requester_email : selectedRequest.employee_name}
                  {selectedRequest.source === "EXTERNAL" && (
                    <span className="bg-[#F2924E]/10 text-[#F2924E] text-[9px] uppercase font-bold px-2 py-0.5 rounded tracking-wider">External</span>
                  )}
                </p>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">EMPLOYEE ID / REF</p>
                <p className="font-bold text-gray-800">{selectedRequest.employee_id || "Unassigned"}</p>
              </div>
            </div>
          </div>

          {/* Assign Employee Panel — for EXTERNAL requests */}
          {selectedRequest.source === "EXTERNAL" && (
            <div className="bg-orange-50/60 border border-[#F2924E]/30 shadow-sm rounded-2xl p-8 mb-4">
              <h3 className="text-[13px] font-bold text-gray-900 mb-1 tracking-wide flex items-center gap-2">
                <User size={14} className="text-[#F2924E]" /> Assign Internal Employee <span className="text-[10px] font-semibold text-gray-400 normal-case tracking-normal">(Optional)</span>
              </h3>
              <p className="text-[12px] text-gray-500 mb-4 font-medium">
                If the request mentions a specific employee, assign them so the document uses their real details. Leave unassigned to generate a generic company document.
              </p>

              {selectedRequest.employee_id && selectedRequest.employee_name && selectedRequest.employee_name !== "External Request" ? (
                <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4">
                  <User size={16} className="text-[#F2924E]" />
                  <span className="font-bold text-gray-900 text-[14px]">{selectedRequest.employee_name}</span>
                  <span className="text-[10px] bg-[#F2924E]/10 text-[#F2924E] font-bold px-2 py-0.5 rounded tracking-wider uppercase">Assigned</span>
                </div>
              ) : (
                <div className="relative">
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5">
                    <Search size={14} className="text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search employee by name (optional)..."
                      value={employeeSearch}
                      onChange={(e) => { setEmployeeSearch(e.target.value); searchEmployees(e.target.value); }}
                      className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400"
                    />
                  </div>
                  {employeeResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                      {employeeResults.map((emp) => (
                        <button
                          key={emp.id}
                          onClick={() => handleAssignEmployee(emp.id, emp.name)}
                          disabled={assigningEmployee}
                          className="w-full text-left px-4 py-3 text-sm font-medium text-gray-800 hover:bg-orange-50 flex items-center gap-2 transition"
                        >
                          <User size={14} className="text-[#F2924E]" /> {emp.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}


          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-8 mb-6">
            <h3 className="text-[13px] font-bold text-gray-900 mb-6 tracking-wide">Request Details</h3>

            <div className="mb-8">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">PURPOSE</p>
              <p className="text-[15px] text-gray-800 leading-relaxed font-medium">
                {selectedRequest.purpose}
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
                  <Mail size={12} /> DELIVERY METHOD
                </p>
                <p className="font-bold text-gray-900 text-[15px]">Email</p>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Calendar size={12} /> REQUESTED DATE
                </p>
                <p className="font-bold text-gray-900 text-[15px]">
                  {new Date(selectedRequest.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-8 mb-8">
            <h3 className="text-[13px] font-bold text-gray-900 mb-5 tracking-wide">Actions</h3>

            {(selectedRequest.status === 'PENDING' || selectedRequest.status === 'NEW') && (
              <div className="bg-orange-50/50 border border-[#F2924E]/30 rounded-xl p-5 flex gap-3.5 mb-7">
                <AlertCircle size={20} className="text-[#F2924E] shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-gray-900 text-[14px] mb-1">New Request</h4>
                  <p className="text-[13px] text-gray-600 font-medium">
                    This request requires your review. Mark as "In Progress" to start working on it, or proceed directly to generate the document.
                  </p>
                </div>
              </div>
            )}

            {selectedRequest.status === 'REJECTED' && selectedRequest.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex gap-3.5 mb-7">
                <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-red-700 text-[14px] mb-1">Request Rejected</h4>
                  <p className="text-[13px] text-red-600 font-medium">
                    Reason: {selectedRequest.rejection_reason}
                  </p>
                </div>
              </div>
            )}

            {selectedRequest.status === 'COMPLETED' && selectedRequest.generated_document_path && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex gap-3.5 mb-7">
                <CheckCircle size={20} className="text-green-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-green-800 text-[14px] mb-2">Document Generated</h4>
                  <a
                    href={`http://localhost:8000/${selectedRequest.generated_document_path}`}
                    onClick={(e) => handleForceDownload(selectedRequest.generated_document_path!, e)}
                    className="inline-flex items-center gap-1.5 text-sm bg-white border border-green-200 shadow-sm text-green-700 px-4 py-2 rounded-lg font-bold hover:bg-green-100 transition cursor-pointer"
                  >
                    <FileText size={14} /> Download Document
                  </a>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 w-full">
              {(selectedRequest.status === 'PENDING' || selectedRequest.status === 'NEW') && (
                <button
                  onClick={() => handleMarkInProgress(selectedRequest.id)}
                  className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[14px] font-bold rounded-xl transition"
                >
                  Mark as In Progress
                </button>
              )}

              {(selectedRequest.status === 'PENDING' || selectedRequest.status === 'NEW' || selectedRequest.status === 'IN_PROGRESS') && (
                <>
                  <button
                    onClick={() => setShowGenerateModal(true)}
                    className="flex-1 py-4 bg-[#F2924E] hover:bg-[#e07d3a] text-white text-[14px] font-bold rounded-xl transition shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    <FileText size={16} /> Generate & Send Document
                  </button>

                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="flex-1 py-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 hover:text-gray-900 text-[14px] font-bold rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <XCircle size={16} /> Reject Request
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals remain the same */}
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
