"use client";

import { useRouter } from "next/navigation";

interface Props {
  active: "request" | "history" | "approval" | "reports";
}

export default function LeaveTabs({ active }: Props) {
  const router = useRouter();

  return (
    <div className="flex gap-6 border-b pb-2">
      <button
        onClick={() => router.push("/apply-leave")}
        className={`pb-2 font-medium text-sm ${
          active === "request"
            ? "text-orange-500 border-b-2 border-orange-500"
            : "text-gray-500"
        }`}
      >
        Request Leave
      </button>

      <button
        onClick={() => router.push("/leave-history")}
        className={`pb-2 font-medium text-sm ${
          active === "history"
            ? "text-orange-500 border-b-2 border-orange-500"
            : "text-gray-500"
        }`}
      >
        Leave History
      </button>

      <button
        onClick={() => router.push("/approval")}
        className={`pb-2 font-medium text-sm ${
          active === "approval"
            ? "text-orange-500 border-b-2 border-orange-500"
            : "text-gray-500"
        }`}
      >
        Approval Panel
      </button>

      <button
        onClick={() => router.push("/reports")}
        className={`pb-2 font-medium text-sm ${
          active === "reports"
            ? "text-orange-500 border-b-2 border-orange-500"
            : "text-gray-500"
        }`}
      >
        Get Reports
      </button>
    </div>
  );
}