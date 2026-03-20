'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import LeaveTabs from '@/components/LeaveTabs';

export default function ApprovalPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <TopBar />

      <div className="ml-64 pt-16">
        <main className="px-10 min-h-[calc(100vh-4rem)] overflow-auto">
          <LeaveTabs active="approval" />

          <h1 className="text-2xl font-semibold mb-4">Approval Panel</h1>
          <p>Managers can review and approve pending leave requests here.</p>
        </main>
      </div>
    </div>
  );
}
