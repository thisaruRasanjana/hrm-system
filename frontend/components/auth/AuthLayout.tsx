"use client";

import React from "react";

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export default function AuthLayout({
  title,
  description,
  children,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gray-50">
      
      {/* Subtle Ambient Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[50%] rounded-full bg-orange-100/40 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[50%] rounded-full bg-[#EE7F22]/10 blur-[100px] pointer-events-none" />
      
      {/* Auth Card */}
      <div className="relative z-10 bg-white w-[420px] p-10 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
        <div className="mb-6 flex justify-center">
          {/* Subtle Logo/Icon placeholder */}
          <div className="w-12 h-12 bg-orange-50 rounded-xl border border-orange-100 flex items-center justify-center text-[#EE7F22]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
        </div>

        <h1 className="text-[28px] font-extrabold text-[#1E293B] text-center tracking-tight">
          {title}
        </h1>

        {description && (
          <p className="text-[15px] font-medium text-[#64748B] text-center mt-2 mb-8">
            {description}
          </p>
        )}

        {children}

      </div>
    </div>
  );
}