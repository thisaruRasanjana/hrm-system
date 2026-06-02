"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthLayout from "@/components/auth/AuthLayout";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";

export default function ResetPassword() {

  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (password !== confirm) {
      alert("Passwords do not match");
      return;
    }

    const email = sessionStorage.getItem("reset_email");

    setLoading(true);

    try {
      await api.post("/auth/reset-password", { email, password });
      router.push("/reset-success");
    } catch (err: any) {
      alert(err.message || "Failed to reset password");
    }

    setLoading(false);
  };

  return (
    <AuthLayout title="Reset Password">

      <form onSubmit={handleSubmit}>

        {/* New Password */}
        <label className="block text-[16px] font-medium text-[#364153] mb-2">
          New Password
        </label>

        <div className="relative mb-6">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Enter new password"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg
            text-[#1E293B] placeholder-[#D1D5DC]
            focus:outline-none focus:ring-2 focus:ring-[#F2924E]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-3 text-gray-500 hover:text-gray-700"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {/* Confirm Password */}
        <label className="block text-[16px] font-medium text-[#364153] mb-2">
          Confirm Password
        </label>

        <div className="relative mb-6">
          <input
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm password"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg
            text-[#1E293B] placeholder-[#D1D5DC]
            focus:outline-none focus:ring-2 focus:ring-[#F2924E]"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />

          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-4 top-3 text-gray-500 hover:text-gray-700"
          >
            {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#F2924E] hover:bg-[#e07f3f] text-white py-3 rounded-lg text-[18px] font-semibold transition"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>

      </form>

    </AuthLayout>
  );
}