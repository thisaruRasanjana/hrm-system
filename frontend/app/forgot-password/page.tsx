"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    await fetch("http://localhost:8000/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    localStorage.setItem("reset_email", email);
    router.push("/verify-otp");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F4F4]">
      <div className="bg-white w-[420px] p-10 rounded-2xl shadow-lg">
        <h1 className="text-[28px] font-semibold text-[#111827] text-center">
          Forgot Password?
        </h1>
        <p className="text-[14px] text-[#6B7280] text-center mt-1 mb-8">
          Enter your email to receive a reset link
        </p>

        <form onSubmit={handleSubmit}>
          <label className="text-[14px] text-[#364153] font-medium">
            Email Address
          </label>

          <input
            type="email"
            placeholder="Enter your email address"
            className="w-full mt-2 mb-6 px-4 py-3 border border-gray-300 rounded-lg 
            text-[#111827] placeholder-[#D1D5DC] focus:outline-none focus:ring-2 focus:ring-[#F2924E]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button
            type="submit"
            className="w-full bg-[#F2924E] hover:bg-[#e07f3f] text-white py-3 rounded-lg text-[16px] font-semibold"
          >
            Send Reset Link
          </button>

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="w-full mt-4 border border-gray-300 py-3 rounded-lg text-[#364153]"
          >
            ← Back to Login
          </button>
        </form>

        <p className="text-center text-[12px] text-[#6B7280] mt-6">
          We'll send you an email with instructions to reset your password.
        </p>
      </div>
    </div>
  );
}
