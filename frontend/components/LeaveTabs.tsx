"use client";

import { usePathname, useRouter } from "next/navigation";

interface Props {
  active: "request" | "history" | "approval" | "reports";
}

export default function LeaveTabs({ active }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const isReportsActive = active === "reports" || pathname.startsWith("/reports");

  return (
    <div className="flex gap-6 border-b pb-2">
      <button
        onClick={() => router.push("/apply-leave")}
        className={`pb-2 text-sm font-medium ${
          active === "request"
            ? "border-b-2 border-orange-500 text-orange-500"
            : "text-gray-500"
        }`}
      >
        Request Leave
      </button>

      <button
        onClick={() => router.push("/leave-history")}
        className={`pb-2 text-sm font-medium ${
          active === "history"
            ? "border-b-2 border-orange-500 text-orange-500"
            : "text-gray-500"
        }`}
      >
        Leave History
      </button>

      <button
        onClick={() => router.push("/approval")}
        className={`pb-2 text-sm font-medium ${
          active === "approval"
            ? "border-b-2 border-orange-500 text-orange-500"
            : "text-gray-500"
        }`}
      >
        Approval panel
      </button>

      <button
        onClick={() => router.push("/reports")}
        className={`pb-2 text-sm font-medium ${
          isReportsActive
            ? "border-b-2 border-orange-500 text-orange-500"
            : "text-gray-500"
        }`}
      >
        Get Reports
      </button>
    </div>
  );
}