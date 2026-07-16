"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Search,
  CheckCheck,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Info,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Archive,
  ArchiveRestore,
  Trash2,
  Inbox,
  RotateCcw,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Notification {
  id: number;
  message: string;
  type: "success" | "warning" | "error" | "info";
  is_read: boolean;
  created_at: string;
  category: string;
  link?: string;
  is_archived: boolean;
  is_deleted: boolean;
}

interface FolderCounts {
  inbox: number;
  unread: number;
  archived: number;
  trash: number;
}

type Folder = "inbox" | "archived" | "trash";

const TYPE_CONFIG = {
  success: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", border: "border-green-100" },
  warning: { icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-100" },
  error: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
  info: { icon: Info, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
} as const;

const FOLDERS: { id: Folder; label: string; icon: typeof Inbox }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "archived", label: "Archived", icon: Archive },
  { id: "trash", label: "Trash", icon: Trash2 },
];

const EMPTY_COPY: Record<Folder, { title: string; body: string }> = {
  inbox: {
    title: "No notifications",
    body: "When important events happen, you'll see them here.",
  },
  archived: {
    title: "Nothing archived",
    body: "Notifications you archive are filed here, out of your inbox.",
  },
  trash: {
    title: "Trash is empty",
    body: "Deleted notifications stay here until you remove them for good.",
  },
};

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<FolderCounts>({ inbox: 0, unread: 0, archived: 0, trash: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [folder, setFolder] = useState<Folder>("inbox");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const refresh = useCallback(async (target: Folder) => {
    try {
      const [listRes, countRes] = await Promise.all([
        apiFetch(`/notifications/?folder=${target}`),
        apiFetch("/notifications/counts"),
      ]);
      if (listRes.ok) setNotifications(await listRes.json());
      if (countRes.ok) setCounts(await countRes.json());
      window.dispatchEvent(new Event("notificationsUpdated"));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setSelected(new Set());
    refresh(folder);
  }, [folder, refresh]);

  /** Run a bulk action on the current selection, then reload the folder. */
  const runBulk = async (path: string) => {
    if (!selected.size || busy) return;
    setBusy(true);
    try {
      await apiFetch(`/notifications/bulk/${path}`, {
        method: "POST",
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      setSelected(new Set());
      await refresh(folder);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (busy || !counts.trash) return;
    if (!confirm("Permanently delete everything in Trash? This cannot be undone.")) return;
    setBusy(true);
    try {
      await apiFetch("/notifications/trash/empty", { method: "POST" });
      setSelected(new Set());
      await refresh(folder);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handlePurgeSelected = async () => {
    if (!selected.size || busy) return;
    if (!confirm(`Permanently delete ${selected.size} notification(s)? This cannot be undone.`)) return;
    await runBulk("purge");
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch("/notifications/read-all", { method: "PUT" });
      await refresh(folder);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpen = async (n: Notification) => {
    // In Trash, clicking shouldn't navigate — the item is meant to be
    // restored or purged, not acted on.
    if (folder === "trash") return;
    if (!n.is_read) {
      try {
        await apiFetch(`/notifications/${n.id}/read`, { method: "PUT" });
        setNotifications(prev => prev.map(x => (x.id === n.id ? { ...x, is_read: true } : x)));
        setCounts(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
        window.dispatchEvent(new Event("notificationsUpdated"));
      } catch (err) {
        console.error(err);
      }
    }
    if (n.link) router.push(n.link);
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = notifications.filter(n => {
    const matchesSearch = n.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "all" || !n.is_read;
    const matchesCategory = categoryFilter === "all" || n.category === categoryFilter;
    return matchesSearch && matchesFilter && matchesCategory;
  });

  const uniqueCategories = Array.from(new Set(notifications.map(n => n.category))).filter(Boolean);
  const allVisibleSelected = filtered.length > 0 && filtered.every(n => selected.has(n.id));

  const toggleSelectAll = () => {
    setSelected(allVisibleSelected ? new Set() : new Set(filtered.map(n => n.id)));
  };

  // Group by date
  const grouped = filtered.reduce<Record<string, Notification[]>>((acc, n) => {
    const label = formatDateLabel(n.created_at);
    if (!acc[label]) acc[label] = [];
    acc[label].push(n);
    return acc;
  }, {});

  const folderCount = (id: Folder) =>
    id === "inbox" ? counts.unread : id === "archived" ? counts.archived : counts.trash;

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-1 text-sm text-[#f08a4b] hover:underline w-fit"
      >
        <ChevronLeft size={16} />
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Bell className="text-[#f08a4b]" size={26} />
            Notifications
            {counts.unread > 0 && (
              <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-1 rounded-full">
                {counts.unread} new
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Stay updated with the latest alerts and activities.</p>
        </div>
        <div className="flex items-center gap-3">
          {folder === "trash" && counts.trash > 0 && (
            <button
              onClick={handleEmptyTrash}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition shadow-sm disabled:opacity-50"
            >
              <Trash2 size={16} />
              Empty trash
            </button>
          )}
          {folder === "inbox" && counts.unread > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition shadow-sm"
            >
              <CheckCheck size={16} />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Folder tabs */}
      <div className="flex items-center gap-1 border-b border-gray-100">
        {FOLDERS.map(({ id, label, icon: Icon }) => {
          const count = folderCount(id);
          const active = folder === id;
          return (
            <button
              key={id}
              onClick={() => setFolder(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
                active
                  ? "border-[#f08a4b] text-[#f08a4b]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Icon size={15} />
              {label}
              {count > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    active ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-[#f08a4b] transition"
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-[#f08a4b] cursor-pointer"
          >
            <option value="all">All Categories</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
            ))}
          </select>
          <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg capitalize transition ${filter === f ? "bg-[#f08a4b] text-white shadow-md" : "text-gray-500 hover:bg-gray-50"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selection action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl">
          <span className="text-sm font-bold text-gray-800">{selected.size} selected</span>
          <div className="h-4 w-px bg-orange-200" />

          {folder !== "trash" && (
            <button
              onClick={() => runBulk("read")}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
            >
              <CheckCheck size={14} />
              Mark read
            </button>
          )}
          {folder === "inbox" && (
            <button
              onClick={() => runBulk("archive")}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
            >
              <Archive size={14} />
              Archive
            </button>
          )}
          {folder === "archived" && (
            <button
              onClick={() => runBulk("unarchive")}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
            >
              <ArchiveRestore size={14} />
              Move to inbox
            </button>
          )}
          {folder === "trash" ? (
            <>
              <button
                onClick={() => runBulk("restore")}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
              >
                <RotateCcw size={14} />
                Restore
              </button>
              <button
                onClick={handlePurgeSelected}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-50"
              >
                <Trash2 size={14} />
                Delete forever
              </button>
            </>
          ) : (
            <button
              onClick={() => runBulk("delete")}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-50"
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}

          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800 transition"
          >
            <X size={14} />
            Clear
          </button>
        </div>
      )}

      {/* Notification list */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-[#f08a4b] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 text-sm italic">Loading notifications...</p>
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="py-24 text-center px-6">
            <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 text-[#f08a4b]">
              <Bell size={40} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {filter === "unread" && folder === "inbox" ? "You're all caught up" : EMPTY_COPY[folder].title}
            </h3>
            <p className="text-gray-500 max-w-xs mx-auto text-sm">
              {filter === "unread" && folder === "inbox"
                ? "You've read everything! Switch to 'All' to see past notifications."
                : EMPTY_COPY[folder].body}
            </p>
          </div>
        ) : (
          <>
            {/* Select-all bar */}
            <label className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50/60 transition">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-[#f08a4b] focus:ring-[#f08a4b]/30 cursor-pointer accent-[#f08a4b]"
              />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {allVisibleSelected ? "Deselect all" : "Select all"}
              </span>
            </label>

            <div className="divide-y divide-gray-50">
              {Object.entries(grouped).map(([label, items]) => (
                <div key={label}>
                  {/* Date group header */}
                  <div className="flex items-center gap-3 px-5 py-3 bg-gray-50/60">
                    <Calendar size={13} className="text-gray-400" />
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</span>
                  </div>

                  {/* Items */}
                  {items.map((n) => {
                    const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
                    const Icon = config.icon;
                    const isSelected = selected.has(n.id);
                    return (
                      <div
                        key={n.id}
                        className={`group flex items-start gap-4 px-5 py-4 transition border-b border-gray-50 last:border-b-0
                          ${isSelected ? "bg-orange-50/60" : !n.is_read && folder !== "trash" ? config.bg : "bg-white hover:bg-gray-50"}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(n.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select notification: ${n.message}`}
                          className="mt-2.5 w-4 h-4 rounded border-gray-300 text-[#f08a4b] focus:ring-[#f08a4b]/30 cursor-pointer accent-[#f08a4b] shrink-0"
                        />
                        <div
                          onClick={() => handleOpen(n)}
                          className={`flex items-start gap-4 flex-1 min-w-0 ${folder === "trash" ? "" : "cursor-pointer"}`}
                        >
                          <div className={`mt-0.5 p-2 rounded-xl ${config.bg} ${config.color} shadow-sm`}>
                            <Icon size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <p className={`text-sm leading-snug ${!n.is_read && folder !== "trash" ? "font-bold text-gray-900" : "text-gray-600"}`}>
                                {n.message}
                              </p>
                              <span className="text-xs text-gray-400 font-medium shrink-0">{formatTime(n.created_at)}</span>
                            </div>
                            {n.link && folder !== "trash" && (
                              <span className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-bold text-[#f08a4b]">
                                View more <ChevronRight size={12} />
                              </span>
                            )}
                          </div>
                          {!n.is_read && folder !== "trash" && (
                            <div className="w-2.5 h-2.5 rounded-full bg-[#f08a4b] mt-2 flex-shrink-0 shadow-[0_0_8px_#f08a4b]" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
