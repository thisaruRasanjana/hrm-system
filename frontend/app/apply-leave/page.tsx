'use client';

import React, { useEffect, useState } from 'react';

import LeaveTabs from '@/components/LeaveTabs';
import LeaveBalanceCards from '@/components/LeaveBalanceCards';
import ApplyLeaveForm from '@/components/ApplyLeaveForm';
import { apiFetch } from '@/lib/api';

type LeaveBalance = {
  leave_type_id: number;
  leave_type_name: string;
  entitlement: number | null;
  used_days: number;
  pending_days: number;
  remaining: number | null;
};

export default function ApplyLeavePage() {
  const [balances, setBalances] = useState<Record<string, number>>({});

  const loadBalances = async () => {
    try {
      const res = await apiFetch('/leave/balance/me');
      if (!res.ok) return;
      const data: LeaveBalance[] = await res.json();
      const map: Record<string, number> = {};
      for (const b of data) {
        if (b.remaining !== null) map[b.leave_type_name] = b.remaining;
      }
      setBalances(map);
    } catch (err) {
      console.error('Failed to load leave balances:', err);
    }
  };

  useEffect(() => {
    loadBalances();
  }, []);

  return (
    <div>
      <LeaveTabs />
      <LeaveBalanceCards balances={balances} />

      <ApplyLeaveForm balances={balances} onSubmitted={loadBalances} />
    </div>
  );
}
