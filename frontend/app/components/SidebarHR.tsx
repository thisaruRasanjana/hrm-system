import {
  LayoutDashboard,
  Shield,
  Users,
  Calendar,
  FileText,
  Settings,
} from "lucide-react";

export default function SidebarHR() {
  return (
    <div className="w-64 bg-[#EAEAEA] border-r border-gray-200 flex flex-col justify-between">

      {/* Top */}
      <div>

        {/* Logo */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4">
          <div className="bg-[#F97316] text-white w-10 h-10 rounded-lg flex items-center justify-center font-semibold">
            HR
          </div>

          <div>
            <h1 className="text-sm font-semibold text-gray-800">HRMS</h1>
            <p className="text-xs text-gray-500">Management System</p>
          </div>
        </div>

        {/* Menu Title */}
        <div className="px-6 mt-6 text-[11px] font-semibold tracking-wide text-gray-400">
          MAIN MENU
        </div>

        {/* Menu */}
        <nav className="mt-3 flex flex-col gap-1 px-4 text-sm">

          <div className="menuItem">
            <LayoutDashboard size={18} />
            Dashboard
          </div>

          <div className="menuItem">
            <Shield size={18} />
            Employee Management
          </div>

          <div className="menuItem">
            <Users size={18} />
            Recruitment
          </div>

          <div className="menuItem">
            <Calendar size={18} />
            Leave
          </div>

          <div className="menuItemActive">
            <FileText size={18} />
            Document
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
  );
}