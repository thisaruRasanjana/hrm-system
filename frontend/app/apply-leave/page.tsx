'use client';

import React, { useState } from 'react';

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
    <div>
      <LeaveTabs />
      <LeaveBalanceCards balances={balances} />

      <ApplyLeaveForm balances={balances} />
    </div>
  );
}
