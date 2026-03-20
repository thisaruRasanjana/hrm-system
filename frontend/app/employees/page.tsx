'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

export default function EmployeesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <TopBar />

      <div className="ml-64 pt-16">
        <main className="px-10 py-8 min-h-[calc(100vh-4rem)] overflow-auto">
          <h1 className="text-2xl font-semibold mb-4">Employee Management</h1>
          <p>Here you'll be able to view and manage employee records.</p>
        </main>
      </div>
    </div>
  );
}
