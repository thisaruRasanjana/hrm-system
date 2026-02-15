import {
  LayoutDashboard,
  Calendar,
  FileText,
  Settings,
} from "lucide-react";

export default function Sidebar() {
  return (
    <div className="w-64 bg-[#EAEAEA] border-r border-gray-300 flex flex-col justify-between">


      {/* Top Section */}
      <div>
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="bg-orange-500 text-white w-10 h-10 flex items-center justify-center rounded-lg font-semibold">
            HR
          </div>
          <div>
            <h1 className="font-semibold text-gray-800">HRMS</h1>
            <p className="text-xs text-gray-500">Management System</p>
          </div>
        </div>

        {/* Menu Title */}
        <div className="px-6 mt-6 text-[11px] tracking-wide font-semibold text-[#8E8E93]">
          MAIN MENU
        </div>


        {/* Menu Items */}
        <nav className="mt-3 flex flex-col gap-2 px-4 text-sm">

          {/* Dashboard */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-md text-gray-600 hover:bg-gray-200 cursor-pointer">
            <LayoutDashboard size={18} />
            Dashboard
          </div>

          {/* Leave */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-md text-gray-600 hover:bg-gray-200 cursor-pointer">
            <Calendar size={18} />
            Leave
          </div>

          {/* Document (Active) */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-md text-[#F2924E] font-medium cursor-pointer">
            <FileText size={18} className="text-[#F2924E]" />
            Document
          </div>

          {/* Settings */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-md text-gray-600 hover:bg-gray-200 cursor-pointer">
            <Settings size={18} />
            Settings
          </div>

        </nav>
      </div>

      {/* Footer */}
      <div className="p-6 text-xs text-gray-400">
        © 2026 HRSM
      </div>

    </div>
  );
}
