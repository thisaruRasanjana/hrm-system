"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, CalendarDays, Clock, MapPin, Users } from "lucide-react";

interface Event {
  title: string;
  type: string;
  typeColor: string;
  description: string;
  date: string;
  time: string;
  location: string;
  attendees: number;
}

const events: Event[] = [
  {
    title: "Team Meeting",
    type: "Meeting",
    typeColor: "bg-blue-100 text-blue-700",
    description: "Weekly team sync to discuss project progress and upcoming milestones.",
    date: "February 15, 2026",
    time: "10:00 AM - 11:00 AM",
    location: "Conference Room A",
    attendees: 8,
  },
  {
    title: "Project Deadline",
    type: "Deadline",
    typeColor: "bg-red-100 text-red-600",
    description: "Final submission deadline for Q1 project deliverables.",
    date: "February 20, 2026",
    time: "5:00 PM",
    location: "Remote",
    attendees: 12,
  },
  {
    title: "Training Session",
    type: "Training",
    typeColor: "bg-green-100 text-green-700",
    description: "New employee orientation and company culture introduction training.",
    date: "February 25, 2026",
    time: "2:00 PM - 4:00 PM",
    location: "Training Room B",
    attendees: 20,
  },
  {
    title: "Q1 Review Presentation",
    type: "Meeting",
    typeColor: "bg-blue-100 text-blue-700",
    description: "Quarterly business review and performance metrics presentation to leadership.",
    date: "March 1, 2026",
    time: "9:00 AM - 11:00 AM",
    location: "Board Room",
    attendees: 15,
  },
  {
    title: "Benefits Enrollment Deadline",
    type: "Deadline",
    typeColor: "bg-red-100 text-red-600",
    description: "Last day to enroll or make changes to your health and benefits package.",
    date: "March 5, 2026",
    time: "5:00 PM",
    location: "HR Portal (Online)",
    attendees: 0,
  },
  {
    title: "Company Town Hall",
    type: "Event",
    typeColor: "bg-purple-100 text-purple-700",
    description: "Monthly all-hands meeting with leadership updates and Q&A session.",
    date: "March 10, 2026",
    time: "3:00 PM - 4:30 PM",
    location: "Main Auditorium",
    attendees: 150,
  },
  {
    title: "Team Building Day",
    type: "Event",
    typeColor: "bg-purple-100 text-purple-700",
    description: "Annual team outing and activities to strengthen team bonds.",
    date: "March 15, 2026",
    time: "10:00 AM - 5:00 PM",
    location: "City Park",
    attendees: 45,
  },
  {
    title: "Performance Review Due",
    type: "Deadline",
    typeColor: "bg-red-100 text-red-600",
    description: "All self-assessment forms must be submitted to HR by end of day.",
    date: "March 20, 2026",
    time: "6:00 PM",
    location: "HR Portal (Online)",
    attendees: 0,
  },
];

export default function UpcomingEventsPage() {
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
          <h1 className="text-2xl font-semibold text-gray-900">Upcoming Events</h1>
          <p className="text-sm text-gray-500 mt-1">Your schedule and important dates at a glance</p>
        </div>
        <span className="border border-[#F2924E] text-[#F2924E] text-sm font-semibold px-3 py-1.5 rounded-lg">
          {events.length} Events
        </span>
      </div>

      {/* Events list */}
      <div className="flex flex-col gap-3">
        {events.map((e, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl p-6">

            {/* Title + type */}
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-base font-semibold text-gray-900">{e.title}</h3>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${e.typeColor}`}>
                {e.type}
              </span>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">{e.description}</p>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-y-2 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <CalendarDays size={13} className="text-gray-400" />
                <span>{e.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-gray-400" />
                <span>{e.time}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-gray-400" />
                <span>{e.location}</span>
              </div>
              {e.attendees > 0 && (
                <div className="flex items-center gap-2">
                  <Users size={13} className="text-gray-400" />
                  <span>{e.attendees} attendees</span>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <button className="text-sm text-[#F2924E] font-medium hover:underline">
                View Details →
              </button>
              <button className="text-sm border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-1.5 rounded-lg transition font-medium">
                Add to Calendar
              </button>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}