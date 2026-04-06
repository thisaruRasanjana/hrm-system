"use client";

import { useState, useEffect } from "react";
import { X, Search, MoreVertical, ArrowLeft, Send, Trash2, CheckSquare, Square } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/* API Base */
const API_URL = "http://localhost:8000/messages";

export interface Message {
  id: number;
  sender_name: string;
  sender_role: string;
  target_group: string;
  subject: string;
  content: string;
  is_deleted: number;
  created_at: string;
}

interface MessagesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewState = "list" | "read" | "compose" | "edit";

export default function MessagesPanel({ isOpen, onClose }: MessagesPanelProps) {
  const [view, setView] = useState<ViewState>("list");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  /* Compose / Edit Form State */
  const [subject, setSubject] = useState("");
  const [targetGroup, setTargetGroup] = useState("All Employees");
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  /* Menu State */
  const [showMenu, setShowMenu] = useState(false);
  const [activeRowMenuId, setActiveRowMenuId] = useState<number | null>(null);

  /* Search & Bulk Action State */
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<"inbox" | "sent" | "trash">("inbox");

  /* Fetch messages */
  const fetchMessages = async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
      setView("list");
      setSelectedMessage(null);
    }
  }, [isOpen]);

  /* Handle Send Message */
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !content.trim()) return;

    setIsSending(true);
    try {
      const payload = {
        sender_name: "John Doe", // Mock current user
        sender_role: "HR Director",
        target_group: targetGroup,
        subject: subject,
        content: content,
      };

      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Clear form & go back to list
      setSubject("");
      setContent("");
      setTargetGroup("All");
      await fetchMessages();
      setView("list");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
  };

  /* Handle Edit Message */
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !content.trim() || !selectedMessage) return;

    setIsSending(true);
    try {
      const payload = {
        subject: subject,
        content: content,
      };

      await fetch(`${API_URL}/${selectedMessage.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Update local state to reflect UI instantly
      setSelectedMessage({ ...selectedMessage, subject, content });
      await fetchMessages();
      setView("read");
    } catch (err) {
      console.error("Failed to edit message:", err);
    } finally {
      setIsSending(false);
    }
  };

  /* Handle Delete */
  const handleDelete = async (ids: number[]) => {
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`${API_URL}/${id}`, {
            method: "DELETE",
          })
        )
      );
      setSelectedIds(new Set());
      setActiveRowMenuId(null);
      await fetchMessages();
    } catch (err) {
      console.error("Failed to delete messages:", err);
    }
  };

  /* Toggle Selection */
  const toggleSelection = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  /* Get Visible Messages */
  const visibleMessages = messages
    .filter(m => {
      if (activeTab === "trash") return m.is_deleted === 1;
      if (activeTab === "sent") return m.is_deleted === 0 && m.sender_name === "John Doe";
      return m.is_deleted === 0 && m.sender_name !== "John Doe"; // inbox
    })
    .filter(msg => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        msg.subject.toLowerCase().includes(q) ||
        msg.sender_name.toLowerCase().includes(q) ||
        msg.target_group.toLowerCase().includes(q) ||
        msg.content.toLowerCase().includes(q)
      );
    });

  /* Toggle Select All */
  const toggleSelectAll = () => {
    if (selectedIds.size === visibleMessages.length && visibleMessages.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleMessages.map(m => m.id)));
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div className="fixed top-0 right-0 h-screen w-[420px] bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300">

        {/* Header - orange */}
        <div className="bg-[#f08a4b] text-white px-6 py-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            {view === "list" ? (
              <div className="w-5" /> // spacing placeholder
            ) : (
              <button
                onClick={() => setView("list")}
                className="hover:bg-white/20 p-1.5 rounded-full transition -ml-1.5"
              >
                <ArrowLeft size={18} />
              </button>
            )}

            <h2 className="text-lg font-semibold tracking-wide text-white">
              {view === "list" && "Messages"}
              {view === "read" && "Messages"}
              {view === "compose" && "New Message"}
              {view === "edit" && "Edit Message"}
            </h2>

            <button
              onClick={onClose}
              className="hover:bg-white/20 p-1.5 text-white rounded-full transition -mr-1.5"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search bar inside header (only in list view) */}
          {view === "list" && (
            <>
              <div className="relative pb-2">
                <Search size={14} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white text-gray-800 text-sm rounded-lg pl-9 pr-4 py-2.5 focus:outline-none placeholder-gray-400"
                />
              </div>

              {/* Tabs inside Header */}
              <div className="flex gap-6 mt-2">
                <button
                  onClick={() => { setActiveTab("inbox"); setSelectedIds(new Set()); }}
                  className={`pb-2 text-sm font-semibold transition border-b-2 ${activeTab === 'inbox' ? 'border-white text-white' : 'border-transparent text-white/70 hover:text-white'}`}
                >
                  Inbox
                </button>
                <button
                  onClick={() => { setActiveTab("sent"); setSelectedIds(new Set()); }}
                  className={`pb-2 text-sm font-semibold transition border-b-2 ${activeTab === 'sent' ? 'border-white text-white' : 'border-transparent text-white/70 hover:text-white'}`}
                >
                  Sent
                </button>
                <button
                  onClick={() => { setActiveTab("trash"); setSelectedIds(new Set()); }}
                  className={`pb-2 text-sm font-semibold transition border-b-2 ${activeTab === 'trash' ? 'border-white text-white' : 'border-transparent text-white/70 hover:text-white'}`}
                >
                  Trash
                </button>
              </div>
            </>
          )}
        </div>

        {/* --- LIST VIEW --- */}
        {view === "list" && (
          <div className="flex-1 overflow-y-auto relative">

            {/* Action Bar (Bulk Delete vs Compose / Select All) */}
            {selectedIds.size > 0 ? (
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-orange-50 sticky top-0 z-10 transition">
                <div className="flex items-center gap-4">
                  <button
                    onClick={toggleSelectAll}
                    className="text-gray-500 hover:text-gray-700 pt-1"
                  >
                    {selectedIds.size === visibleMessages.length && visibleMessages.length > 0 ? (
                      <CheckSquare size={18} className="text-[#f08a4b]" />
                    ) : (
                      <div className="relative">
                        <Square size={18} className="text-[#f08a4b]" />
                        {/* Indeterminate state dot */}
                        <div className="absolute inset-0 m-auto w-2 h-2 bg-[#f08a4b] rounded-[2px]" />
                      </div>
                    )}
                  </button>
                  <span className="text-sm font-semibold text-[#f08a4b]">{selectedIds.size} selected</span>
                </div>
                <button
                  onClick={() => handleDelete(Array.from(selectedIds))}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg text-sm font-semibold transition"
                >
                  <Trash2 size={16} />
                  {activeTab === "trash" ? "Delete Forever" : "Trash"}
                </button>
              </div>
            ) : (
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white z-10 sticky top-0 transition">
                <div
                  className="flex items-center gap-3 cursor-pointer text-gray-300 hover:text-gray-400 pt-1 ml-0.5"
                  onClick={toggleSelectAll}
                >
                  <Square size={18} />
                  <span className="text-[13px] font-semibold text-gray-500 uppercase tracking-wider">Select All</span>
                </div>
                <button
                  onClick={() => {
                    setSubject("");
                    setContent("");
                    setTargetGroup("All Employees");
                    setView("compose");
                  }}
                  className="text-[#f08a4b] text-sm font-semibold hover:underline"
                >
                  + New Message
                </button>
              </div>
            )}

            {visibleMessages.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No messages found in {activeTab}.</div>
            ) : (
              visibleMessages.map((msg) => {
                const initials = msg.sender_name === "John Doe"
                  ? msg.target_group.substring(0, 2).toUpperCase()
                  : msg.sender_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                const isSelected = selectedIds.has(msg.id);
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-4 p-4 border-b border-gray-100 transition relative group ${isSelected ? 'bg-orange-50/50' : 'hover:bg-gray-50'} ${activeRowMenuId === msg.id ? 'z-20' : 'z-0'}`}
                  >
                    {/* Checkbox */}
                    <div
                      className="pt-2 cursor-pointer text-gray-300 hover:text-gray-400 group-hover:opacity-100"
                      onClick={() => toggleSelection(msg.id)}
                    >
                      {isSelected ? (
                        <CheckSquare size={18} className="text-[#f08a4b]" />
                      ) : (
                        <Square size={18} />
                      )}
                    </div>

                    {/* Avatar (Click to Read) */}
                    <div
                      className="h-10 w-10 shrink-0 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center font-bold text-sm cursor-pointer"
                      onClick={() => { setSelectedMessage(msg); setView("read"); }}
                    >
                      {initials}
                    </div>

                    {/* Content preview */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer pr-4"
                      onClick={() => { setSelectedMessage(msg); setView("read"); }}
                    >
                      <div className="flex justify-between items-start mb-0.5">
                        <h4 className="font-semibold text-gray-900 text-[15px] truncate pr-2">
                          {msg.sender_name === "John Doe" ? msg.target_group : msg.sender_name}
                        </h4>
                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                          </span>
                          {/* Unread indicator dot */}
                          <div className="w-1.5 h-1.5 bg-[#f08a4b] rounded-full" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-1 font-medium">
                        {msg.sender_name === "John Doe" ? "Sent" : msg.sender_role}
                      </p>
                      <p className="text-sm text-gray-600 truncate">{msg.subject}</p>
                    </div>

                    {/* Row level More menu */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveRowMenuId(activeRowMenuId === msg.id ? null : msg.id);
                        }}
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-200"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {activeRowMenuId === msg.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 shadow-xl rounded-lg py-1 w-36 z-20">
                          {msg.sender_name === "John Doe" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveRowMenuId(null);
                                setSubject(msg.subject);
                                setContent(msg.content);
                                setSelectedMessage(msg);
                                setView("edit");
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                            >
                              Edit Message
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete([msg.id]);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition border-t border-gray-50"
                          >
                            {activeTab === "trash" ? "Delete Forever" : "Move to Trash"}
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })
            )}
          </div>
        )}

        {/* --- READ VIEW --- */}
        {view === "read" && selectedMessage && (
          <div className="flex-1 flex flex-col bg-gray-50">
            {/* Thread Header */}
            <div className="bg-white p-5 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center font-bold text-sm">
                  {selectedMessage.sender_name === "John Doe"
                    ? selectedMessage.target_group.substring(0, 2).toUpperCase()
                    : selectedMessage.sender_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">
                    {selectedMessage.sender_name === "John Doe" ? selectedMessage.target_group : selectedMessage.sender_name}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {selectedMessage.sender_name === "John Doe" ? "Sent" : selectedMessage.sender_role}
                  </p>
                </div>
              </div>
              {selectedMessage.sender_name === "John Doe" && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-full transition"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {showMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 shadow-lg rounded-lg py-1 w-36 z-10">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setSubject(selectedMessage.subject);
                          setContent(selectedMessage.content);
                          setView("edit");
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                      >
                        Edit Message
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Thread Body */}
            <div className="flex-1 overflow-y-auto p-5 pb-8">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-4">{selectedMessage.subject}</h3>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {selectedMessage.content}
                </div>
                <div className="text-[11px] text-gray-400 mt-6 font-medium">
                  {formatDistanceToNow(new Date(selectedMessage.created_at), { addSuffix: true })}
                </div>
              </div>
            </div>

            {/* Footer only if not sender */}
            {selectedMessage.sender_name !== "John Doe" && (
              <div className="bg-white p-4 border-t border-gray-100 text-center text-xs text-gray-400">
                This is a read-only message. You cannot reply.
              </div>
            )}
          </div>
        )}

        {/* --- COMPOSE VIEW --- */}
        {view === "compose" && (
          <form onSubmit={handleSend} className="flex-1 flex flex-col bg-gray-50">
            <div className="p-5 flex-1 overflow-y-auto space-y-4">

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">TO (TARGET GROUP)</label>
                <select
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:border-[#f08a4b]"
                  value={targetGroup}
                  onChange={(e) => setTargetGroup(e.target.value)}
                >
                  <option value="All Employees">All Employees</option>
                  <option value="Team Leads">Team Leads</option>
                  <option value="HR Managers">HR Managers</option>
                  <option value="Development Team">Development Team</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">SUBJECT</label>
                <input
                  type="text"
                  required
                  placeholder="Message subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:border-[#f08a4b]"
                />
              </div>

              <div className="flex-1 flex flex-col">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">MESSAGE</label>
                <textarea
                  required
                  placeholder="Type your message here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full flex-1 min-h-[200px] border border-gray-200 rounded-lg p-3 text-sm bg-white focus:outline-none focus:border-[#f08a4b] resize-none"
                />
              </div>

            </div>

            <div className="p-4 bg-white flex justify-end pb-8">
              <button
                type="submit"
                disabled={isSending}
                className="bg-[#f08a4b] hover:bg-[#e47d3d] text-white px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50"
              >
                {isSending ? "Sending..." : "Send Message"}
                {!isSending && <Send size={14} className="-rotate-45 -mt-1" />}
              </button>
            </div>
          </form>
        )}

        {/* --- EDIT VIEW --- */}
        {view === "edit" && selectedMessage && (
          <form onSubmit={handleEdit} className="flex-1 flex flex-col bg-gray-50">
            <div className="p-5 flex-1 overflow-y-auto space-y-4">

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">TO (TARGET GROUP)</label>
                <div className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-gray-100 text-gray-500 cursor-not-allowed">
                  {selectedMessage.target_group}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">SUBJECT</label>
                <input
                  type="text"
                  required
                  placeholder="Message subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:border-[#f08a4b]"
                />
              </div>

              <div className="flex-1 flex flex-col">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">MESSAGE</label>
                <textarea
                  required
                  placeholder="Type your message here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full flex-1 min-h-[200px] border border-gray-200 rounded-lg p-3 text-sm bg-white focus:outline-none focus:border-[#f08a4b] resize-none"
                />
              </div>

            </div>

            <div className="p-4 bg-white flex justify-end pb-8">
              <button
                type="submit"
                disabled={isSending}
                className="bg-[#f08a4b] hover:bg-[#e47d3d] text-white px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50"
              >
                {isSending ? "Saving..." : "Save Changes"}
                {!isSending && <Send size={14} className="-rotate-45 -mt-1" />}
              </button>
            </div>
          </form>
        )}

      </div>
    </>
  );
}
