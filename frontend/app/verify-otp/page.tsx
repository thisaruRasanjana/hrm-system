"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function VerifyOTP() {
  const router = useRouter();
  const [otp, setOtp] = useState("");

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    const email = localStorage.getItem("reset_email");

    if (!email) {
      alert("Email missing. Please restart password reset.");
      router.push("/forgot-password");
      return;
    }

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
      return;
    }

    router.push("/reset-password");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F4F4]">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-10 rounded-2xl shadow-xl w-[380px]"
      >
        <h2 className="text-2xl font-bold text-gray-900 text-center">
          Enter OTP
        </h2>

        <p className="text-sm text-gray-600 text-center mt-1 mb-6">
          Enter the verification code sent to your email
        </p>

        <input
          type="text"
          placeholder="Enter OTP"
          className="w-full mb-4 px-4 py-3 border border-gray-400 rounded-lg 
          text-gray-900 placeholder-gray-500 
          focus:outline-none focus:ring-2 focus:ring-[#F2924E]"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          required
        />

        <button
          type="submit"
          className="w-full bg-[#F2924E] hover:bg-[#e07f3f] text-white py-3 rounded-lg font-semibold transition"
        >
          Verify OTP
        </button>

        <p
          className="text-sm text-gray-600 hover:text-[#F2924E] mt-4 text-center cursor-pointer transition"
          onClick={() => router.push("/login")}
        >
          Back to Login
        </p>
      </form>
    </div>
  );
}