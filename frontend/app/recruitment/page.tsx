'use client';

import React from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

export default function RecruitmentPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <TopBar />

      <div className="ml-64 pt-16">
        <main className="px-10 py-8 min-h-[calc(100vh-4rem)] overflow-auto">
          <h1 className="text-2xl font-semibold mb-4">Recruitment</h1>
          <p>This page will manage job postings and applications.</p>
        </main>
      </div>
    </div>
  );
}
