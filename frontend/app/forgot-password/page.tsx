"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthLayout from "@/components/auth/AuthLayout";
import { api } from "@/lib/api";
import { useDialog } from "@/context/dialog-context";

export default function ForgotPassword() {
  const router = useRouter();
  const { showAlert } = useDialog();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (!email) {
      await showAlert("Please enter your email.", { title: "Email required", tone: "warning" });
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/send-otp", { email });
      sessionStorage.setItem("reset_email", email);
      await showAlert("Check your inbox for the verification code.", {
        title: "OTP sent",
        tone: "success",
      });
      router.push("/verify-otp");
    } catch (err: any) {
      await showAlert(err.message || "Failed to send OTP", { title: "Couldn't send OTP" });
    }

    setLoading(false);
  };

  return (
    <AuthLayout
      title="Forgot Password"
      description="Enter your email to receive OTP"
    >
      <form onSubmit={handleSubmit}>

        <input
          type="email"
          placeholder="Enter your email"
          className="w-full mb-6 px-4 py-3 border border-gray-300 rounded-lg
          text-[#1E293B] placeholder-[#D1D5DC]
          focus:outline-none focus:ring-2 focus:ring-[#F2924E]"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#F2924E] hover:bg-[#e07f3f] text-white py-3 rounded-lg text-[18px] font-semibold transition"
        >
          {loading ? "Sending..." : "Send OTP"}
        </button>

      </form>
    </AuthLayout>
  );
}