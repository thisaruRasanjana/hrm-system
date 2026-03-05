"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (!email) {
      alert("Please enter your email");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      console.log("OTP response:", data);

      if (!res.ok) {
        alert(data.detail || "Failed to send OTP");
        return;
      }

      // Save email for next steps
      localStorage.setItem("reset_email", email);

      alert("OTP sent successfully!");

      // Go to OTP verification page
      router.push("/verify-otp");

    } catch (error) {
      console.error("OTP error:", error);
      alert("Backend server not reachable");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F4F4]">
      <form
        onSubmit={handleSubmit}
        className="bg-white w-[420px] p-10 rounded-2xl shadow-lg"
      >
        <h1 className="text-[28px] font-semibold text-[#111827] text-center">
          Forgot Password?
        </h1>

        <p className="text-[14px] text-[#6B7280] text-center mt-1 mb-8">
          Enter your email to receive OTP
        </p>

        <input
          type="email"
          placeholder="Enter your email"
          className="w-full mb-6 px-4 py-3 border border-gray-300 rounded-lg"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#F2924E] hover:bg-[#e07f3f] text-white py-3 rounded-lg font-semibold transition"
        >
          {loading ? "Sending..." : "Send OTP"}
        </button>
      </form>
    </div>
  );
}