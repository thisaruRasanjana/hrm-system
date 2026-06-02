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
    <div className="min-h-screen flex items-center justify-center bg-[#F4F4F4]">

      <div className="bg-white w-[420px] p-10 rounded-2xl shadow-xl">

        <h1 className="text-[32px] font-bold text-[#1E293B] text-center">
          {title}
        </h1>

        {description && (
          <p className="text-[16px] text-[#64748B] text-center mt-2 mb-8">
            {description}
          </p>
        )}

        {children}

      </div>

    </div>
  );
}