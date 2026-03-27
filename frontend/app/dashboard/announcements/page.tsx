"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, CalendarDays } from "lucide-react";

interface Announcement {
  title: string;
  time: string;
  by: string;
  description: string;
  tag: string;
  tagColor: string;
  priority: "high priority" | "medium priority" | "low priority";
}

const announcements: Announcement[] = [
  {
    title: "Company Holiday - February 14, 2026",
    time: "2 days ago",
    by: "HR Department",
    description: "Please note that the office will be closed on February 14th in observance of Valentine's Day. Regular operations will resume on February 15th.",
    tag: "Holiday",
    tagColor: "bg-purple-100 text-purple-700",
    priority: "high priority",
  },
  {
    title: "New Health Benefits Package Announced",
    time: "1 week ago",
    by: "Benefits Team",
    description: "We're excited to announce enhanced health benefits including dental and vision coverage. Enrollment begins March 1st. Visit the HR portal for details.",
    tag: "Benefits",
    tagColor: "bg-green-100 text-green-700",
    priority: "medium priority",
  },
  {
    title: "Q1 Performance Review Schedule",
    time: "1 week ago",
    by: "Management Team",
    description: "Q1 performance reviews will be conducted throughout March. Your manager will reach out to schedule your review meeting.",
    tag: "Review",
    tagColor: "bg-blue-100 text-blue-700",
    priority: "medium priority",
  },
  {
    title: "Office Renovation Notice",
    time: "2 weeks ago",
    by: "Facilities Team",
    description: "The 3rd floor office space will undergo renovation from Feb 20 - Mar 5. Affected teams will be temporarily relocated to Floor 2.",
    tag: "Facilities",
    tagColor: "bg-yellow-100 text-yellow-700",
    priority: "low priority",
  },
  {
    title: "New HR Policy Update",
    time: "3 weeks ago",
    by: "HR Department",
    description: "Remote work policy has been updated. Maximum 3 remote days per week starting March 1st. Please review the updated policy document in the portal.",
    tag: "Policy",
    tagColor: "bg-orange-100 text-orange-700",
    priority: "medium priority",
  },
];

const priorityColor: Record<string, string> = {
  "high priority":   "bg-red-100 text-red-600",
  "medium priority": "bg-orange-100 text-orange-600",
  "low priority":    "bg-gray-100 text-gray-500",
};

export default function AnnouncementsPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">

      {/* Back */}
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-1 text-sm text-[#F2924E] hover:underline w-fit"
      >
        <ChevronLeft size={16} /> Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">All Announcements</h1>
          <p className="text-sm text-gray-500 mt-1">Stay updated with the latest company news and updates</p>
        </div>
        <span className="border border-[#F2924E] text-[#F2924E] text-sm font-semibold px-3 py-1.5 rounded-lg">
          {announcements.length} Total
        </span>
      </div>

      {/* List */}
      <div className="flex flex-col gap-0">
        {announcements.map((a, i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-2xl p-6 mb-3"
          >
            {/* Title + tags */}
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-base font-semibold text-gray-900">{a.title}</h3>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${a.tagColor}`}>
                  {a.tag}
                </span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${priorityColor[a.priority]}`}>
                  {a.priority}
                </span>
              </div>
            </div>

            {/* Meta */}
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
              <CalendarDays size={12} />
              <span>{a.time}</span>
              <span>•</span>
              <span>By {a.by}</span>
            </div>

            {/* Body */}
            <p className="text-sm text-gray-600 mt-3 leading-relaxed">{a.description}</p>

            {/* Read More */}
            <button className="text-sm text-[#F2924E] font-medium mt-3 hover:underline">
              Read More →
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}