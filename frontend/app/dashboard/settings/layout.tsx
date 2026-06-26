"use client";

import SettingsTabs from "../../components/SettingsTabs";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="mb-8">
        <SettingsTabs />
      </div>

      {children}
    </div>
  );
}
