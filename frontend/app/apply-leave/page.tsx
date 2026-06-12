'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import LeaveTabs from '@/components/LeaveTabs';
import LeaveBalanceCards from '@/components/LeaveBalanceCards';
import ApplyLeaveForm from '@/components/ApplyLeaveForm';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth-context';

type LeaveBalance = {
  leave_type_id: number;
  leave_type_name: string;
  entitlement: number | null;
  used_days: number;
  pending_days: number;
  remaining: number | null;
};

export default function ApplyLeavePage() {
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const canRequest = hasPermission('leave:request');

  const [balances, setBalances] = useState<Record<string, number>>({});

  // Reviewers without self-service leave (e.g. Super Admin) land on approvals
  useEffect(() => {
    if (!authLoading && !canRequest) {
      if (hasPermission('leave:approve')) {
        router.replace('/approval');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [authLoading, canRequest, router]);

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
    if (canRequest) loadBalances();
  }, [canRequest]);

  if (authLoading || !canRequest) return null;

  return (
    <div>
      <LeaveTabs />
      <LeaveBalanceCards balances={balances} />

      <ApplyLeaveForm balances={balances} onSubmitted={loadBalances} />
    </div>
  );
}
