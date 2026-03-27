"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, MapPin, Clock, Mail, Phone } from "lucide-react";

type Status = "available" | "on_leave";
type Tab = "all" | "available" | "on_leave";

interface Member {
  name: string;
  initials: string;
  role: string;
  status: Status;
  location: string;
  hours: string;
  email: string;
  phone: string;
}

const members: Member[] = [
  { name: "Sarah Johnson",  initials: "SJ", role: "Senior Developer",  status: "available", location: "Office - Floor 3", hours: "9:00 AM - 5:00 PM",  email: "sarah.j@company.com",  phone: "+1 555-0101" },
  { name: "Emily Davis",    initials: "ED", role: "UX Designer",       status: "on_leave",  location: "On Leave",        hours: "Feb 10 - Feb 14",   email: "emily.d@company.com",  phone: "+1 555-0102" },
  { name: "James Wilson",   initials: "JW", role: "Backend Developer", status: "available", location: "Remote",           hours: "10:00 AM - 6:00 PM", email: "james.w@company.com",  phone: "+1 555-0103" },
  { name: "Lisa Anderson",  initials: "LA", role: "QA Engineer",       status: "available", location: "Office - Floor 2", hours: "8:00 AM - 4:00 PM",  email: "lisa.a@company.com",   phone: "+1 555-0104" },
];

const availableCount = members.filter((m) => m.status === "available").length;
const onLeaveCount   = members.filter((m) => m.status === "on_leave").length;

export default function TeamAvailabilityPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");

  const filtered = members.filter((m) => {
    if (tab === "available") return m.status === "available";
    if (tab === "on_leave")  return m.status === "on_leave";
    return true;
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "all",       label: "All Team" },
    { key: "available", label: "Available" },
    { key: "on_leave",  label: "On Leave" },
  ];

  return (
    <div className="flex flex-col gap-6">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <button onClick={() => router.push("/dashboard")} className="hover:text-[#F2924E] transition">
          Dashboard
        </button>
        <ChevronRight size={14} />
        <span className="text-gray-800 font-medium">Team Availability</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Team Availability</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time status of your team members</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
            {availableCount} Available
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1.5 font-medium text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" />
            {onLeaveCount} On Leave
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              tab === t.key
                ? "bg-[#F2924E] text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Member grid */}
      <div className="grid grid-cols-2 gap-5">
        {filtered.map((m) => {
          const isAvailable = m.status === "available";
          return (
            <div
              key={m.name}
              className={`bg-white border rounded-2xl p-6 ${
                isAvailable ? "border-green-200" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${
                      isAvailable ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {m.initials}
                    </div>
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                      isAvailable ? "bg-green-500" : "bg-gray-400"
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                    <p className="text-xs text-gray-500">{m.role}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium ${
                  isAvailable ? "text-green-600" : "text-gray-500"
                }`}>
                  {isAvailable ? "Available" : "On Leave"}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                  <span>{m.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={12} className="text-gray-400 flex-shrink-0" />
                  <span>{m.hours}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                <button className="flex items-center gap-1.5 text-xs text-[#F2924E] hover:underline font-medium">
                  <Mail size={12} /> Email
                </button>
                <button className="flex items-center gap-1.5 text-xs text-[#F2924E] hover:underline font-medium">
                  <Phone size={12} /> Call
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}