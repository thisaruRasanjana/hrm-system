'use client';

import React, { useState } from 'react';

import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import LeaveTabs from '@/components/LeaveTabs';
import LeaveBalanceCards from '@/components/LeaveBalanceCards';
import ApplyLeaveForm from '@/components/ApplyLeaveForm';

export default function ApplyLeavePage() {
  // mock balance data
  const [balances] = useState({
    Annual: 8,
    Casual: 2,
    Medical: 5,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* fixed sidebar and header live outside the flow; main content gets offsets */}
      <Sidebar />
      <TopBar />

      <div className="ml-64 pt-16">
        <main className="px-10 pt-4 pb-8 min-h-[calc(100vh-4rem)] overflow-auto">
          <LeaveTabs />
          <LeaveBalanceCards balances={balances} />

          <ApplyLeaveForm balances={balances} />
        </main>
      </div>
    </div>
  );
}
