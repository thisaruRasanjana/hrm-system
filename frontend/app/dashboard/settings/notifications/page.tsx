"use client";

import { useState, useEffect } from "react";
import { Bell, Clock, Loader2, Trash2 } from "lucide-react";
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
  { id: "attendance", title: "Attendance Reminders", desc: "Clock-in/out and timesheet reminders" },
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
  const [quietHours, setQuietHours] = useState({
    start: "22:00",
    end: "08:00"
  });
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

      if (user.quiet_hours_start) setQuietHours(prev => ({ ...prev, start: user.quiet_hours_start as string }));
      if (user.quiet_hours_end) setQuietHours(prev => ({ ...prev, end: user.quiet_hours_end as string }));
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
          quiet_hours_start: quietHours.start,
          quiet_hours_end: quietHours.end,
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Bell size={20} className="text-gray-800" />
            <h2 className="text-xl font-bold text-gray-900">Notification Settings</h2>
          </div>
          <p className="text-gray-400 text-sm font-medium tracking-wide">Manage what notifications you receive from the system</p>
        </div>
        {saveMessage && (
          <span className={`text-sm font-medium ${saveMessage.includes("Failed") ? "text-red-500" : "text-green-500"}`}>
            {saveMessage}
          </span>
        )}
      </div>
      
      <form onSubmit={handleSave}>
        
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

        {/* Quiet Hours */}
        <div className="mb-8 border-t border-gray-100 pt-10">
          <div className="flex items-center gap-3 mb-1">
            <Clock size={20} className="text-gray-800" />
            <h2 className="text-xl font-bold text-gray-900">Quiet Hours</h2>
          </div>
          <p className="text-gray-400 text-sm font-medium mb-8 tracking-wide">
            Mute non-urgent notifications during specific hours. Security alerts will bypass quiet hours.
          </p>

          <div className="grid grid-cols-2 gap-8 max-w-lg">
            <div>
              <label className="block text-xs font-semibold text-gray-600 tracking-wider uppercase mb-2">Start Time</label>
              <input
                type="time"
                value={quietHours.start}
                onChange={(e) => setQuietHours({ ...quietHours, start: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f08a4b]/20 focus:border-[#f08a4b] transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 tracking-wider uppercase mb-2">End Time</label>
              <input
                type="time"
                value={quietHours.end}
                onChange={(e) => setQuietHours({ ...quietHours, end: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f08a4b]/20 focus:border-[#f08a4b] transition-all"
              />
            </div>
          </div>
        </div>

        {/* Notification retention */}
        <div className="mb-8 border-t border-gray-100 pt-10">
          <div className="flex items-center gap-3 mb-1">
            <Trash2 size={20} className="text-gray-800" />
            <h2 className="text-xl font-bold text-gray-900">Notification Retention</h2>
          </div>
          <p className="text-gray-400 text-sm font-medium mb-8 tracking-wide">
            Choose how long notifications are kept before they are removed automatically.
          </p>

          <div className="max-w-lg">
            <label
              htmlFor="retention"
              className="block text-xs font-semibold text-gray-600 tracking-wider uppercase mb-2"
            >
              Keep notifications for
            </label>
            <select
              id="retention"
              value={retentionDays === null ? "never" : String(retentionDays)}
              onChange={(e) =>
                setRetentionDays(e.target.value === "never" ? null : Number(e.target.value))
              }
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#f08a4b]/20 focus:border-[#f08a4b] transition-all cursor-pointer"
            >
              {RETENTION_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value === null ? "never" : String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-400 font-medium">
              Notifications older than this are permanently deleted and cannot be restored.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-gray-100">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-3 bg-[#f08a4b] hover:bg-[#e0793a] text-white text-sm font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving && <Loader2 size={16} className="animate-spin" />}
            {isSaving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </form>
    </div>
  );
}
