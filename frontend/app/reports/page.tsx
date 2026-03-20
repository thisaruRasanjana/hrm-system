'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import LeaveTabs from '@/components/LeaveTabs';

export default function ReportsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <TopBar />

      <div className="ml-64 pt-16">
        <main className="px-10 py-8 min-h-[calc(100vh-4rem)] overflow-auto">
          <LeaveTabs active="reports" />

          <h1 className="text-2xl font-semibold mb-4">Reports</h1>
          <p>Generate and view leave reports from here.</p>
        </main>
      </div>
    </div>
  );
}
