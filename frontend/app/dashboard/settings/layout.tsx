"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Shield, Bell, SlidersHorizontal, ChevronLeft } from "lucide-react";
import Topbar from "@/components/dashboard/Topbar";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    {
      name: "Profile",
      desc: "Personal Information",
      href: "/dashboard/settings/profile",
      icon: User,
    },
    {
      name: "Security",
      desc: "Password & Authentication",
      href: "/dashboard/settings/security",
      icon: Shield,
    },
    {
      name: "Notification",
      desc: "Email & Alerts",
      href: "/dashboard/settings/notifications",
      icon: Bell,
    },
    {
      name: "Preferences",
      desc: "Display",
      href: "/dashboard/settings/preferences",
      icon: SlidersHorizontal,
    },
  ];

  return (
    <div className="flex flex-1 overflow-hidden bg-white">
      {/* Sidebar */}
      <aside className="w-64 bg-[#f3f4f6] flex flex-col border-r border-gray-200 shrink-0">
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-800 hover:text-gray-600 transition font-semibold text-lg cursor-pointer">
            <ChevronLeft size={20} />
            Settings
          </Link>
        </div>
        
        <nav className="flex-1 flex flex-col gap-2 px-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-start gap-3 p-3 rounded-lg transition group cursor-pointer"
              >
                <div className={`mt-0.5 ${isActive ? 'text-[#f08a4b]' : 'text-gray-600 group-hover:text-gray-800'}`}>
                  <Icon size={18} />
                </div>
                <div>
                  <h4 className={`font-semibold text-sm ${isActive ? 'text-[#f08a4b]' : 'text-gray-800'}`}>
                    {item.name}
                  </h4>
                  <p className={`text-xs mt-0.5 ${isActive ? 'text-[#f08a4b]/80' : 'text-gray-400'}`}>
                    {item.desc}
                  </p>
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <Topbar />

        {/* Scrollable Children */}
        <div className="flex-1 overflow-y-auto p-10 bg-white">
          {children}
        </div>
      </div>
    </div>
  );
}
