'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import LeaveTabs from '@/components/LeaveTabs';
import AssignLeaveForm from '@/components/AssignLeaveForm';
import { useAuth } from '@/context/auth-context';

export default function AssignLeavePage() {
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const canAssign = hasPermission('leave:assign');

  useEffect(() => {
    if (!authLoading && !canAssign) {
      router.replace('/dashboard');
    }
  }, [authLoading, canAssign, router]);

  if (authLoading || !canAssign) return null;

  return (
    <div>
      <LeaveTabs />
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Assign Leave</h2>
        <p className="text-gray-600 text-sm mt-1">Assign leave to an employee who cannot apply for it themselves.</p>
      </div>

      <AssignLeaveForm />
    </div>
  );
}
