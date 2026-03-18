"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { name: "My Document", path: "/hr/documents" },
  { name: "Request Document", path: "/hr/documents/request" },
  { name: "Approval Document", path: "/hr/documents/approval" },
  { name: "Template Management", path: "/hr/documents/templates_management" },
  { name: "Request Management", path: "/hr/documents/request_management" },
];

export default function DocumentTabsHR() {
  const pathname = usePathname();

  return (
    <div className="inline-flex w-max bg-white p-1 rounded-full shadow-md border">
      {tabs.map((tab) => {

        let active = false;

        if (tab.path === "/hr/documents") {
          // Only exact match
          active = pathname === tab.path;
        } else {
          // Match exact path or sub-routes with trailing slash
          active = pathname === tab.path || pathname.startsWith(`${tab.path}/`);
        }

        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`px-6 py-2 rounded-full text-sm font-medium transition ${
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