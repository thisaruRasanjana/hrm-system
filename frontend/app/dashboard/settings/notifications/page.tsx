"use client";

import { useState, useEffect } from "react";
import { Bell, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";

type NotificationType = {
  id: string;
  title: string;
  desc: string;
  email: boolean;
  inApp: boolean;
  forceInApp?: boolean;
};

const Toggle = ({ 
  checked, 
  onChange,
  disabled = false
}: { 
  checked: boolean; 
  onChange: () => void; 
  disabled?: boolean;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={disabled ? undefined : onChange}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
      checked ? "bg-[#f08a4b]" : "bg-gray-300"
    } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

const NOTIFICATION_CATEGORIES = [
  { id: "leave", title: "Leave Request Updates", desc: "Notifications about your leave request status" },
  { id: "recruitment", title: "Recruitment Updates", desc: "Applicants, interviews and panel assignments" },
  { id: "announcement", title: "Company Announcements", desc: "Important company-wide announcements" },
  { id: "events", title: "Event Updates", desc: "New, updated and cancelled events, plus day-before reminders" },
  { id: "holiday", title: "Holiday Reminders", desc: "Upcoming public and company holidays" },
  { id: "celebration", title: "Birthdays & Work Anniversaries", desc: "Celebrations for your colleagues" },
  { id: "document", title: "Document & Request Alerts", desc: "Alerts for document requests and reviews" },
  { id: "system", title: "System Updates", desc: "Core system changes and welcome messages", forceInApp: true },
  { id: "security", title: "Security Alerts", desc: "Password changes, 2FA updates, new logins", forceInApp: true },
];

// null = never auto-delete. Values are days, and must match the windows the
// backend accepts in UserNotificationUpdate.
const RETENTION_OPTIONS: { value: number | null; label: string }[] = [
  { value: 30, label: "Keep for 1 month" },
  { value: 90, label: "Keep for 3 months" },
  { value: 180, label: "Keep for 6 months" },
  { value: 365, label: "Keep for 1 year" },
  { value: null, label: "Keep forever" },
];

export default function NotificationSettingsPage() {
  const { user, refreshUser } = useAuth();
  
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Load preferences from user context on mount
  useEffect(() => {
    if (user) {
      const prefs = user.notification_preferences || {};
      const mapped = NOTIFICATION_CATEGORIES.map(cat => ({
        ...cat,
        email: prefs[cat.id] ? prefs[cat.id].email : true,
        inApp: prefs[cat.id] ? prefs[cat.id].inApp : true,
      }));
      setNotifications(mapped);
      setRetentionDays(user.notification_retention_days ?? null);
    }
  }, [user]);

  const toggleSetting = (index: number, type: "email" | "inApp") => {
    const newSettings = [...notifications];
    if (type === "inApp" && newSettings[index].forceInApp) return; // cannot disable forceInApp
    newSettings[index][type] = !newSettings[index][type];
    setNotifications(newSettings);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage("");
    
    try {
      const preferencesPayload: Record<string, any> = {};
      notifications.forEach(n => {
        preferencesPayload[n.id] = { email: n.email, inApp: n.inApp };
      });

      await apiFetch("/auth/notifications", {
        method: "PUT",
        body: JSON.stringify({
          notification_preferences: preferencesPayload,
          notification_retention_days: retentionDays
        })
      });
      
      await refreshUser();
      setSaveMessage("Settings saved successfully");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (err) {
      setSaveMessage("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (!notifications.length) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="w-full max-h-full pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Notification Settings</h2>
          <p className="text-gray-400 text-sm font-medium">Manage what notifications you receive from the system.</p>
        </div>
      </div>
      
      <form onSubmit={handleSave}>
        {saveMessage && (
          <div className={`p-4 mb-6 rounded-xl text-sm font-bold border ${saveMessage.includes("Failed") ? "bg-red-50 border-red-100 text-red-600" : "bg-green-50 border-green-100 text-green-700"}`}>
            {saveMessage}
          </div>
        )}
        
        {/* Notifications Table Box */}
        <div className="border border-gray-100 rounded-xl overflow-hidden mb-12 shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-12 items-center px-6 py-4 bg-white border-b border-gray-100">
            <div className="col-span-8 font-bold text-sm text-gray-900 tracking-wide">Notification Type</div>
            <div className="col-span-2 font-bold text-sm text-gray-900 tracking-wide text-center">Email</div>
            <div className="col-span-2 font-bold text-sm text-gray-900 tracking-wide text-center">In-App</div>
          </div>
          
          {/* Rows */}
          <div className="bg-white divide-y divide-gray-100">
            {notifications.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-12 items-center px-6 py-5 hover:bg-gray-50/50 transition duration-150">
                <div className="col-span-8">
                  <h4 className="font-semibold text-gray-800 text-sm mb-0.5">{item.title}</h4>
                  <p className="text-xs font-medium text-gray-400 tracking-wide">{item.desc}</p>
                </div>
                <div className="col-span-2 flex justify-center">
                  <Toggle checked={item.email} onChange={() => toggleSetting(idx, "email")} />
                </div>
                <div className="col-span-2 flex justify-center">
                  <Toggle 
                    checked={item.forceInApp ? true : item.inApp} 
                    onChange={() => toggleSetting(idx, "inApp")} 
                    disabled={item.forceInApp}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notification Retention */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Trash2 size={16} className="text-[#f08a4b]"/> Notification Retention</h3>
          </div>
          
          <div className="p-6">
            <p className="text-sm text-gray-500 font-medium mb-6">
              Choose how long notifications are kept before they are removed automatically. Notifications older than this are permanently deleted and cannot be restored.
            </p>

            <div className="max-w-xl">
              <label
                htmlFor="retention"
                className="block text-sm font-bold text-gray-700 mb-2"
              >
                Keep notifications for
              </label>
              <div className="relative">
                <select
                  id="retention"
                  value={retentionDays === null ? "never" : String(retentionDays)}
                  onChange={(e) =>
                    setRetentionDays(e.target.value === "never" ? null : Number(e.target.value))
                  }
                  className="w-full border border-gray-200 rounded-xl p-3 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#EE7F22]/20 focus:border-[#EE7F22] bg-white transition appearance-none cursor-pointer"
                >
                  {RETENTION_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value === null ? "never" : String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-[#f08a4b] hover:bg-[#e07a3b] text-white px-8 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 shadow-md shadow-orange-100 flex items-center justify-center min-w-[150px]"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </span>
            ) : "Save Preferences"}
          </button>
        </div>
      </form>
    </div>
  );
}
