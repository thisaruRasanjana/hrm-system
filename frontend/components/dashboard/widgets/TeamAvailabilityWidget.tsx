"use client";

import { useRouter } from "next/navigation";
import { Users } from "lucide-react";

const people = [
  { name: "Sarah J.", initials: "SJ", status: "available" },
  { name: "James W.", initials: "JW", status: "available" },
  { name: "Lisa A.",  initials: "LA", status: "available" },
  { name: "Emily D.", initials: "ED", status: "on_leave"  },
];

interface Props { canManageContent?: boolean; canManageHolidays?: boolean; }
export default function TeamAvailabilityWidget(_: Props) {
  const router = useRouter();

  const available = people.filter((p) => p.status === "available");
  const onLeave   = people.filter((p) => p.status === "on_leave");

  return (
    <div
      className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm h-full w-full flex flex-col"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-semibold text-gray-800">Team Availability</h3>
        <Users size={16} className="text-gray-400" />
      </div>

      {/* Available */}
      <p className="text-xs font-semibold text-green-600 mb-2">
        ● AVAILABLE ({available.length})
      </p>
      <div className="space-y-2">
        {available.map((p) => (
          <div key={p.name} className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-xl">
            <div className="w-7 h-7 rounded-full bg-green-400 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {p.initials}
            </div>
            <span className="text-sm text-gray-700">{p.name}</span>
          </div>
        ))}
      </div>

      {/* On Leave */}
      {onLeave.length > 0 && (
        <>
          <p className="text-xs font-semibold text-gray-400 mt-4 mb-2">
            ● ON LEAVE ({onLeave.length})
          </p>
          <div className="space-y-2">
            {onLeave.map((p) => (
              <div key={p.name} className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-xl">
                <div className="w-7 h-7 rounded-full bg-gray-400 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {p.initials}
                </div>
                <span className="text-sm text-gray-700">{p.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-gray-100 flex justify-end">
        <button 
          onClick={() => router.push("/dashboard/team")}
          className="text-[#f2924e] text-[10px] font-bold uppercase tracking-wider hover:underline"
        >
          View All
        </button>
      </div>
    </div>
  );
}
