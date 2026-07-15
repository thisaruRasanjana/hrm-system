'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import LeaveTabs from '@/components/LeaveTabs';
import LeaveBalanceCards from '@/components/LeaveBalanceCards';
import ApplyLeaveForm from '@/components/ApplyLeaveForm';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/auth-context';

import { LeaveBalanceData } from '@/components/LeaveBalanceCards';

export default function ApplyLeavePage() {
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const canRequest = hasPermission('leave:request');

  const [balances, setBalances] = useState<LeaveBalanceData[]>([]);

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
      const data: LeaveBalanceData[] = await res.json();
      setBalances(data);
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

      <ApplyLeaveForm onSubmitted={loadBalances} />
    </div>
  );
}
