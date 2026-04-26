'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import LeaveTabs from '@/components/LeaveTabs';
import LeaveBalanceCards from '@/components/LeaveBalanceCards';
import ApplyLeaveForm from '@/components/ApplyLeaveForm';
import { API_BASE_URL, getAuthHeaders } from '@/app/lib/api';

export default function ApplyLeavePage() {
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loadingBalance, setLoadingBalance] = useState(true);

  useEffect(() => {
    async function fetchBalance() {
      try {
        const res = await fetch(`${API_BASE_URL}/leave/balance/me`, {
          headers: getAuthHeaders(),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Failed to fetch balance');
        const data: Record<string, number> = await res.json();
        setBalances(data);
      } catch (err) {
        console.error('Balance fetch error:', err);
        // Fallback to defaults if API fails
        setBalances({ 'Annual Leave': 15, 'Casual Leave': 10, 'Medical Leave': 15 });
      } finally {
        setLoadingBalance(false);
      }
    }

    fetchBalance();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <TopBar />

      <div className="ml-64 pt-16">
        <main className="px-10 pt-4 pb-8 min-h-[calc(100vh-4rem)] overflow-auto">
          <LeaveTabs />

          {loadingBalance ? (
            <div className="grid grid-cols-3 gap-6 mb-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-[#FFF3E6] border border-[#F5C28B] rounded-xl p-5 animate-pulse">

                  <div className="h-3 bg-orange-200 rounded w-24 mb-3" />
                  <div className="h-7 bg-orange-200 rounded w-16" />
                </div>
              ))}
            </div>
          ) : (
            <LeaveBalanceCards balances={balances} />
          )}

          <ApplyLeaveForm balances={balances} />
        </main>
      </div>
    </div>
  );
}
