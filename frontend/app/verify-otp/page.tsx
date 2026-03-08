"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthLayout from "@/components/auth/AuthLayout";

export default function VerifyOTP() {

  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    const email = localStorage.getItem("reset_email");

    if (!email) {
      alert("Email missing. Please restart password reset.");
      router.push("/forgot-password");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Invalid OTP");
        setLoading(false);
        return;
      }

      router.push("/reset-password");

    } catch (error) {
      alert("Backend server not reachable");
    }

    setLoading(false);
  };

  return (
    <AuthLayout
      title="Verify OTP"
      description="Enter the verification code sent to your email"
    >
      <form onSubmit={handleSubmit}>

        <input
          type="text"
          placeholder="Enter OTP"
          className="w-full mb-6 px-4 py-3 border border-gray-300 rounded-lg
          text-[#1E293B] placeholder-[#D1D5DC]
          focus:outline-none focus:ring-2 focus:ring-[#F2924E]"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#F2924E] hover:bg-[#e07f3f] text-white py-3 rounded-lg text-[18px] font-semibold transition"
        >
          {loading ? "Verifying..." : "Verify OTP"}
        </button>

        <p
          className="text-[14px] text-[#64748B] hover:text-[#F2924E] mt-6 text-center cursor-pointer transition"
          onClick={() => router.push("/login")}
        >
          Back to Login
        </p>

      </form>
    </AuthLayout>
  );
}