"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    name: "My Document",
    path: "/documents",
  },
  {
    name: "Request Document",
    path: "/documents/request",
  },
  {
    name: "Approval document",
    path: "/documents/approval",
  },
  {
    name: "Template Management",
    path: "/documents/templates",
  },
  {
    name: "Request Management",
    path: "/documents/request-management",
  },
];

export default function DocumentTabs() {
  const pathname = usePathname();

  return (
    <div className="inline-flex bg-white p-1 rounded-full shadow-md border">
      {tabs.map((tab) => {
        const active = pathname === tab.path;

        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`px-6 py-2 rounded-full text-sm font-medium transition
              ${
                active
                  ? "bg-[#F2924E] text-white"
                  : "text-gray-600 hover:text-gray-800"
              }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}