"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, FilePlus, LayoutDashboard, Calendar, Settings } from "lucide-react";
import Navbar from "../components/Navbar";

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const menuItems = [
    { name: "My Documents", href: "/employee/documents", icon: FileText },
    { name: "Request Document", href: "/employee/documents/request", icon: FilePlus },
  ];

  return (
    <div className="flex h-screen bg-[#f3f4f6]">
      {/* Sidebar */}
      <div className="w-64 bg-[#EAEAEA] border-r border-gray-200 flex flex-col justify-between">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 pt-6 pb-4">
            <div className="bg-[#F97316] text-white w-10 h-10 rounded-lg flex items-center justify-center font-semibold">
              HR
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-800">HRMS</h1>
              <p className="text-xs text-gray-500">Employee Portal</p>
            </div>
          </div>

          {/* Menu Title */}
          <div className="px-6 mt-6 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
            Documents
          </div>

          {/* Menu */}
          <nav className="mt-3 flex flex-col gap-1 px-4 text-sm">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <div className={isActive ? "menuItemActive" : "menuItem"}>
                    <item.icon size={18} />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="px-6 mt-6 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
            Other
          </div>
          <nav className="mt-3 flex flex-col gap-1 px-4 text-sm opacity-50 cursor-not-allowed">
            <div className="menuItem">
              <LayoutDashboard size={18} />
              Dashboard
            </div>
            <div className="menuItem">
              <Calendar size={18} />
              Leave
            </div>
            <div className="menuItem">
              <Settings size={18} />
              Settings
            </div>
          </nav>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 text-xs text-gray-400">
          © 2026 HRSM
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex justify-center overflow-hidden">
        <div className="w-full max-w-7xl flex flex-col">
          <Navbar />
          <main className="flex-1 overflow-y-auto px-12 py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
