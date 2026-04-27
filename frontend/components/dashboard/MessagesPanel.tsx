"use client";

import { useState, useEffect } from "react";
import { X, Search, MoreVertical, ArrowLeft, Send, Trash2, CheckSquare, Square, RotateCcw, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

/** Maximum number of characters shown in the message list preview snippet. */
const MESSAGE_PREVIEW_LENGTH = 60;

export interface Message {
  id: number;
  sender_id: number;
  sender_name: string;
  subject: string;
  content: string;
  target_group: string;
  is_read: boolean;
  is_deleted: boolean;
  sender_deleted: boolean;
  created_at: string;
}

interface MessagesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewState = "list" | "read" | "compose" | "sent_success";

export default function MessagesPanel({ isOpen, onClose }: MessagesPanelProps) {
  const { user, hasPermission } = useAuth();
  
  // Permission-driven visibility
  const canSend = hasPermission("messaging.send");

  const [view, setView] = useState<ViewState>("list");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  const [subject, setSubject] = useState("");
  const [targetGroup, setTargetGroup] = useState("All Employees");
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sentSubject, setSentSubject] = useState("");
  const [sentTarget, setSentTarget] = useState("");

  const [activeRowMenuId, setActiveRowMenuId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  type TabType = "inbox" | "sent" | "trash";
  const [activeTab, setActiveTab] = useState<TabType>("inbox");
  const [departments, setDepartments] = useState<string[]>([]);

  /** Fetches messages for the active tab (inbox / sent / trash) from the backend. */
  const fetchMessages = async () => {
    try {
      const res = await apiFetch(`/messages/${activeTab}`);
      if (res.ok) setMessages(await res.json());
    } catch (err) { console.error("Failed to fetch messages:", err); }
  };

  /**
   * Fetches the list of roles/departments from the backend to populate
   * the "To (Target Group)" dropdown in the compose view.
   */
  const fetchDepartments = async () => {
    try {
      const res = await apiFetch("/roles/");
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.map((r: any) => r.name));
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
      setView("list");
      setSelectedMessage(null);
      if (canSend) fetchDepartments();
    }
  }, [isOpen, activeTab, canSend]);

  // ── Send ─────────────────────────────────────────────────────────────────────
  /**
   * Submits a new message to the backend.
   * Resets the compose form fields on success and transitions to the
   * sent_success confirmation view, then refreshes the sent tab in the background.
   */
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !content.trim()) return;
    setIsSending(true);
    try {
      const res = await apiFetch("/messages/", {
        method: "POST",
        body: JSON.stringify({ target_group: targetGroup, subject, content }),
      });
      if (res.ok) {
        setSentSubject(subject);
        setSentTarget(targetGroup);
        setSubject(""); setContent(""); setTargetGroup("All Employees");
        setView("sent_success");
        // Switch to sent tab and refresh in background
        setActiveTab("sent");
        fetchMessages();
      }
    } catch (err) { console.error(err); }
    finally { setIsSending(false); }
  };

  /**
   * Soft-deletes a message (moves it to trash) via a PUT request.
   * If the message is currently open in the read view, returns to the list view.
   */
  const handleSoftDelete = async (id: number) => {
    try {
      await apiFetch(`/messages/${id}/delete`, { method: "PUT" });
      await fetchMessages();
      setActiveRowMenuId(null);
      if (selectedMessage?.id === id) setView("list");
    } catch (err) { console.error(err); }
  };

  /** Restores a soft-deleted message from the trash back to its original folder. */
  const handleRestore = async (id: number) => {
    try {
      await apiFetch(`/messages/${id}/restore`, { method: "PUT" });
      await fetchMessages();
      setActiveRowMenuId(null);
    } catch (err) { console.error(err); }
  };

  /** Permanently deletes a message that is already in the trash. */
  const handlePermanentDelete = async (id: number) => {
    try {
      await apiFetch(`/messages/${id}/permanent`, { method: "DELETE" });
      await fetchMessages();
      setActiveRowMenuId(null);
    } catch (err) { console.error(err); }
  };

  /**
   * Opens a message in the read view.
   * If the message is unread and in the inbox, marks it as read on the backend
   * and optimistically updates local state to avoid a full list refetch.
   */
  const handleMarkRead = async (msg: Message) => {
    if (msg.is_read || activeTab !== "inbox") {
      setSelectedMessage(msg);
      setView("read");
      return;
    }
    try {
      await apiFetch(`/messages/${msg.id}/read`, { method: "PUT" });
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
      setSelectedMessage({ ...msg, is_read: true });
      setView("read");
    } catch (err) { console.error(err); }
  };

  /** Toggles the checkbox selection state of a single message row. */
  const toggleSelection = (id: number) => {
    const updatedSelection = new Set(selectedIds);
    updatedSelection.has(id) ? updatedSelection.delete(id) : updatedSelection.add(id);
    setSelectedIds(updatedSelection);
  };

  const visibleMessages = messages.filter((msg) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      msg.subject?.toLowerCase().includes(q) ||
      msg.sender_name.toLowerCase().includes(q) ||
      msg.content.toLowerCase().includes(q)
    );
  });

  /**
   * Selects all visible (filtered) messages if none or some are selected;
   * deselects all if every visible message is already selected.
   */
  const toggleSelectAll = () => {
    if (selectedIds.size === visibleMessages.length && visibleMessages.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleMessages.map((m) => m.id)));
    }
  };

  /** Extracts up to 2 uppercase initials from a full name string. Returns "??" if empty. */
  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase() || "??";

  // Label for sent tab: show recipient group instead of "Me"
  /**
   * Returns the display label for the sender/recipient column.
   * In the sent tab, maps the target_group key to a human-readable group name.
   * In all other tabs, returns the sender's full name.
   */
  const recipientLabel = (msg: Message) => {
    if (activeTab !== "sent") return msg.sender_name;
    const map: Record<string, string> = {
      "All Employees": "All Employees",
      "All": "Everyone",
      "HR": "HR Department",
      "HR Manager": "HR Department",
    };
    return `→ ${map[msg.target_group] || msg.target_group}`;
  };

  /**
   * Returns the 2–3 character initials for the avatar in the message list.
   * Uses group abbreviations (ALL, HR) in the sent tab;
   * falls back to sender name initials in other tabs.
   */
  const recipientInitials = (msg: Message) => {
    if (activeTab !== "sent") return initials(msg.sender_name);
    const tg = msg.target_group;
    if (tg === "All" || tg === "All Employees") return "ALL";
    if (tg === "HR" || tg === "HR Manager") return "HR";
    return tg.substring(0, 2).toUpperCase();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40 transition-opacity" onClick={onClose} />

      <div className="fixed top-0 right-0 h-screen w-[420px] bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="bg-[#f08a4b] text-white px-6 py-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            {(view === "read" || view === "compose") ? (
              <button onClick={() => setView("list")} className="hover:bg-white/20 p-1.5 rounded-full transition -ml-1.5">
                <ArrowLeft size={18} />
              </button>
            ) : view === "sent_success" ? (
              <div className="w-5" />
            ) : <div className="w-5" />}
            <h2 className="text-lg font-semibold tracking-wide">
              {view === "list" && "Messages"}
              {view === "read" && "Message"}
              {view === "compose" && "New Message"}
              {view === "sent_success" && "Messages"}
            </h2>
            <button onClick={onClose} className="hover:bg-white/20 p-1.5 rounded-full transition -mr-1.5">
              <X size={18} />
            </button>
          </div>

          {(view === "list" || view === "sent_success") && (
            <>
              <div className="relative pb-2">
                <Search size={14} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white text-gray-800 text-sm rounded-lg pl-9 pr-4 py-2.5 focus:outline-none placeholder-gray-400"
                />
              </div>

              {/* Tabs */}
              <div className="flex gap-6 mt-1">
                <TabButton label="Inbox" active={activeTab === "inbox"} onClick={() => { setActiveTab("inbox"); setSelectedIds(new Set()); setView("list"); }} />
                {canSend && (
                  <TabButton label="Sent" active={activeTab === "sent"} onClick={() => { setActiveTab("sent"); setSelectedIds(new Set()); setView("list"); }} />
                )}
                <TabButton label="Trash" active={activeTab === "trash"} onClick={() => { setActiveTab("trash"); setSelectedIds(new Set()); setView("list"); }} />
              </div>
            </>
          )}
        </div>

        {/* ── SENT SUCCESS VIEW ── */}
        {view === "sent_success" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center bg-gray-50">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={40} className="text-green-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Message Sent!</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Your message <span className="font-semibold text-gray-700">"{sentSubject}"</span> was sent to{" "}
                <span className="font-semibold text-[#f08a4b]">{sentTarget}</span> successfully.
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => { setView("compose"); setSubject(""); setContent(""); setTargetGroup("All Employees"); }}
                className="bg-[#f08a4b] hover:bg-[#e47d3d] text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition"
              >
                <Send size={16} /> Send Another
              </button>
              <button
                onClick={() => setView("list")}
                className="bg-white border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-bold hover:bg-gray-50 transition"
              >
                Back to {activeTab === "sent" ? "Sent" : "Inbox"}
              </button>
            </div>
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {view === "list" && (
          <div className="flex-1 overflow-y-auto relative">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              {selectedIds.size > 0 ? (
                <>
                  <div className="flex items-center gap-3">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-[#f08a4b] pt-0.5">
                      <CheckSquare size={18} className="text-[#f08a4b]" />
                    </button>
                    <span className="text-sm font-semibold text-[#f08a4b]">{selectedIds.size} selected</span>
                  </div>
                  <div className="flex gap-2">
                    {activeTab === "trash" && (
                      <button onClick={async () => {
                        for (const id of Array.from(selectedIds)) await apiFetch(`/messages/${id}/restore`, { method: "PUT" });
                        setSelectedIds(new Set()); fetchMessages();
                      }} className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg text-sm font-semibold">
                        <RotateCcw size={16} /> Restore
                      </button>
                    )}
                    <button onClick={async () => {
                      const method = activeTab === "trash" ? "DELETE" : "PUT";
                      const suffix = activeTab === "trash" ? "/permanent" : "/delete";
                      for (const id of Array.from(selectedIds)) await apiFetch(`/messages/${id}${suffix}`, { method });
                      setSelectedIds(new Set()); fetchMessages();
                    }} className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg text-sm font-semibold">
                      <Trash2 size={16} /> {activeTab === "trash" ? "Delete Forever" : "Trash"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div onClick={toggleSelectAll} className="flex items-center gap-3 cursor-pointer text-gray-300 hover:text-gray-500">
                    <Square size={18} />
                    <span className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider">Select All</span>
                  </div>
                  {canSend && (
                    <button
                      onClick={() => { setSubject(""); setContent(""); setTargetGroup("All Employees"); setView("compose"); }}
                      className="text-[#f08a4b] text-sm font-semibold hover:underline"
                    >
                      + New Message
                    </button>
                  )}
                </>
              )}
            </div>

            {visibleMessages.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                {activeTab === "inbox" ? "Your inbox is empty." : `No messages in ${activeTab}.`}
              </div>
            ) : (
              visibleMessages.map((msg) => {
                const isSelected = selectedIds.has(msg.id);
                const isUnread = !msg.is_read && activeTab === "inbox";
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-4 p-4 border-b border-gray-100 relative group transition-colors
                      ${isSelected ? "bg-orange-50/50" : isUnread ? "bg-blue-50/40 hover:bg-blue-50/60" : "hover:bg-gray-50"}`}
                  >
                    {/* Unread indicator bar */}
                    {isUnread && (
                      <div className="absolute left-0 top-0 h-full w-1 bg-[#f08a4b] rounded-r" />
                    )}

                    <div className="pt-2 cursor-pointer text-gray-300" onClick={() => toggleSelection(msg.id)}>
                      {isSelected ? <CheckSquare size={18} className="text-[#f08a4b]" /> : <Square size={18} />}
                    </div>

                    {/* Avatar */}
                    <div
                      className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm cursor-pointer
                        ${activeTab === "sent" ? "bg-[#f08a4b]/15 text-[#f08a4b]" : "bg-gray-200 text-gray-600"}`}
                      onClick={() => handleMarkRead(msg)}
                    >
                      {recipientInitials(msg)}
                    </div>

                    <div className="flex-1 min-w-0 cursor-pointer pr-4" onClick={() => handleMarkRead(msg)}>
                      <div className="flex justify-between items-start mb-0.5">
                        <h4 className={`text-[15px] truncate pr-2 ${isUnread ? "font-bold text-gray-900" : "font-semibold text-gray-700"}`}>
                          {recipientLabel(msg)}
                        </h4>
                        <span className="text-xs text-gray-400 shrink-0">
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className={`text-sm truncate ${isUnread ? "font-semibold text-gray-700" : "text-gray-500"}`}>
                        {msg.subject}
                      </p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{msg.content.substring(0, MESSAGE_PREVIEW_LENGTH)}...</p>
                    </div>

                    {/* Unread dot */}
                    {isUnread && (
                      <div className="absolute right-10 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#f08a4b]" />
                    )}

                    {/* Row menu */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100">
                      <button onClick={(e) => { e.stopPropagation(); setActiveRowMenuId(activeRowMenuId === msg.id ? null : msg.id); }} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-200">
                        <MoreVertical size={18} />
                      </button>
                      {activeRowMenuId === msg.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 shadow-xl rounded-lg py-1 w-36 z-20">
                          {activeTab === "trash" ? (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); handleRestore(msg.id); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                <RotateCcw size={14} /> Restore
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handlePermanentDelete(msg.id); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-50">
                                <Trash2 size={14} /> Delete Forever
                              </button>
                            </>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); handleSoftDelete(msg.id); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                              <Trash2 size={14} /> Move to Trash
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── READ VIEW ── */}
        {view === "read" && selectedMessage && (
          <div className="flex-1 flex flex-col bg-gray-50">
            <div className="bg-white p-5 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center font-bold text-sm">
                  {initials(selectedMessage.sender_name)}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">{selectedMessage.sender_name}</h4>
                  <p className="text-xs text-gray-500">{formatDistanceToNow(new Date(selectedMessage.created_at), { addSuffix: true })}</p>
                </div>
              </div>
              <button onClick={() => handleSoftDelete(selectedMessage.id)} className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition">
                <Trash2 size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 pb-8">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-gray-900 text-lg">{selectedMessage.subject}</h3>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded font-bold uppercase tracking-wider">
                    To: {selectedMessage.target_group}
                  </span>
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedMessage.content}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── COMPOSE VIEW ── */}
        {view === "compose" && canSend && (
          <form onSubmit={handleSend} className="flex-1 flex flex-col bg-gray-50">
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">To (Target Group)</label>
                <select className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:border-[#f08a4b]" value={targetGroup} onChange={(e) => setTargetGroup(e.target.value)}>
                  <option value="All Employees">All Employees</option>
                  <option value="HR">HR Department</option>
                  <option value="All">Everyone (Global)</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Subject</label>
                <input type="text" required placeholder="Enter subject..." value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:border-[#f08a4b]" />
              </div>
              <div className="flex-1 flex flex-col">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">Message Body</label>
                <textarea required placeholder="Write your message..." value={content} onChange={(e) => setContent(e.target.value)} className="w-full flex-1 min-h-[250px] border border-gray-200 rounded-lg p-3 text-sm bg-white focus:outline-none focus:border-[#f08a4b] resize-none" />
              </div>
            </div>
            <div className="p-4 bg-white border-t border-gray-100 flex justify-end pb-8">
              <button type="submit" disabled={isSending} className="bg-[#f08a4b] hover:bg-[#e47d3d] text-white px-8 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50">
                {isSending ? "Sending..." : <><Send size={16} /> Send Message</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

/**
 * Reusable tab button used inside the MessagesPanel header.
 * Highlights the active tab with a bottom border and full-white text.
 */
function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`pb-2 text-sm font-semibold transition border-b-2 ${active ? "border-white text-white" : "border-transparent text-white/70 hover:text-white"}`}>
      {label}
    </button>
  );
}
