"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const handleSubmit = (e: any) => {
    e.preventDefault();
    router.push("/reset-success");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F4F4]">
      <div className="bg-white w-[420px] p-10 rounded-2xl shadow-lg">
        <h1 className="text-[28px] font-semibold text-[#111827] text-center">
          Reset Password
        </h1>
        <p className="text-[14px] text-[#6B7280] text-center mt-1 mb-8">
          Create a new password for your account
        </p>

        <form onSubmit={handleSubmit}>
          <label className="text-[14px] text-[#364153] font-medium">
            New Password
          </label>
          <input
            type="password"
            placeholder="Enter new password"
            className="w-full mt-2 mb-6 px-4 py-3 border border-gray-300 rounded-lg 
            text-[#111827] placeholder-[#D1D5DC] focus:outline-none focus:ring-2 focus:ring-[#F2924E]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <label className="text-[14px] text-[#364153] font-medium">
            Confirm Password
          </label>
          <input
            type="password"
            placeholder="Confirm new password"
            className="w-full mt-2 mb-6 px-4 py-3 border border-gray-300 rounded-lg 
            text-[#111827] placeholder-[#D1D5DC] focus:outline-none focus:ring-2 focus:ring-[#F2924E]"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />

          <button
            type="submit"
            className="w-full bg-[#F2924E] hover:bg-[#e07f3f] text-white py-3 rounded-lg text-[16px] font-semibold"
          >
            Reset Password
          </button>
        </form>

        <div className="mt-6 bg-blue-100 p-4 rounded-lg text-[13px] text-blue-800">
          <strong>Security tip:</strong> Use a strong password with a mix of letters, numbers, and symbols.
        </div>
      </div>
    </div>
  );
}
