"use client";

import { useState } from "react";
import { Bell, Clock } from "lucide-react";

type NotificationType = {
  id: string;
  title: string;
  desc: string;
  email: boolean;
  push: boolean;
};

const Toggle = ({ 
  checked, 
  onChange 
}: { 
  checked: boolean; 
  onChange: () => void; 
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
      checked ? "bg-[#f08a4b]" : "bg-gray-300"
    }`}
  >
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

export default function NotificationSettingsPage() {
  const [notifications, setNotifications] = useState<NotificationType[]>([
    { id: "leave", title: "Leave Request Updates", desc: "Notifications about your leave request status", email: true, push: true },
    { id: "attendance", title: "Attendance Reminders", desc: "Notifications about your leave request status", email: true, push: false },
    { id: "recruit", title: "Recruitment Updates", desc: "Notifications about applicants and interviews", email: true, push: false },
    { id: "company", title: "Company Announcements", desc: "Important company-wide announcements", email: true, push: true },
    { id: "holiday", title: "Holiday Reminders", desc: "Upcoming holidays and events", email: true, push: false },
    { id: "document", title: "Document Expiry Alerts", desc: "Alerts when documents are about to expire", email: true, push: true },
  ]);

  const [quietHours, setQuietHours] = useState({
    start: "10:00 PM",
    end: "8:00 AM"
  });

  const [isSaving, setIsSaving] = useState(false);

  const toggleSetting = (index: number, type: "email" | "push") => {
    const newSettings = [...notifications];
    newSettings[index][type] = !newSettings[index][type];
    setNotifications(newSettings);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Simulate API call to PUT /auth/notifications
      await new Promise((res) => setTimeout(res, 600));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-h-full pb-10">
      <div className="flex items-center gap-3 mb-1">
        <Bell size={20} className="text-gray-800" />
        <h2 className="text-xl font-bold text-gray-900">Notification Settings</h2>
      </div>
      <p className="text-gray-400 text-sm font-medium ml-8 mb-8">Manage what notifications you receive from the system</p>
      
      <form onSubmit={handleSave}>
        
        {/* Notifications Table Box */}
        <div className="ml-8 border border-gray-100 rounded-xl overflow-hidden mb-12 shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-12 items-center px-6 py-4 bg-white border-b border-gray-100">
            <div className="col-span-8 font-bold text-sm text-gray-900 tracking-wide">Notification Type</div>
            <div className="col-span-2 font-bold text-sm text-gray-900 tracking-wide text-center">Email</div>
            <div className="col-span-2 font-bold text-sm text-gray-900 tracking-wide text-center">Push</div>
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
                  <Toggle checked={item.push} onChange={() => toggleSetting(idx, "push")} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="ml-8 mb-8 border-t border-gray-100 pt-10">
          <div className="flex items-center gap-3 mb-1">
            <Clock size={20} className="text-gray-800" />
            <h2 className="text-xl font-bold text-gray-900">Quiet Hours</h2>
          </div>
          <p className="text-gray-400 text-sm font-medium ml-8 mb-8 tracking-wide">Mute non-urgent notifications during specific hours</p>

          <div className="ml-8 grid grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2 tracking-wide">Start Time</label>
              <input 
                type="text" 
                value={quietHours.start}
                onChange={(e) => setQuietHours({...quietHours, start: e.target.value})}
                className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-900 font-medium focus:outline-none focus:border-[#f08a4b] bg-white transition"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2 tracking-wide">End Time</label>
              <input 
                type="text" 
                value={quietHours.end}
                onChange={(e) => setQuietHours({...quietHours, end: e.target.value})}
                className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-900 font-medium focus:outline-none focus:border-[#f08a4b] bg-white transition"
              />
            </div>
          </div>
          <p className="text-gray-300 text-xs font-medium mt-4 ml-8">* All times are available</p>
        </div>

        <div className="flex justify-end pt-2">
          <button 
            type="submit"
            disabled={isSaving}
            className="bg-[#f08a4b] hover:bg-[#e07a3b] text-white px-8 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          >
             {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
