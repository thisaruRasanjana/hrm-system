"use client";

import { SlidersHorizontal } from "lucide-react";

export default function PreferencesSettingsPage() {
  return (
    <div className="w-full max-h-full pb-10">
      <div className="flex items-center gap-3 mb-1">
        <SlidersHorizontal size={20} className="text-gray-800" />
        <h2 className="text-xl font-bold text-gray-900">Preferences</h2>
      </div>
      <p className="text-gray-400 text-sm font-medium ml-8 mb-8">Customize your display and local settings</p>
      
      <div className="ml-8 text-center py-20 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
        <SlidersHorizontal size={32} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-gray-500 font-semibold mb-1">Preferences Coming Soon</h3>
        <p className="text-gray-400 text-sm">Display customization tools will be added in a future update.</p>
      </div>

    </div>
  );
}
