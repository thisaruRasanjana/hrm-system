"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (password !== confirm) {
      alert("Passwords do not match");
      return;
    }

    const email = localStorage.getItem("reset_email");
    console.log("EMAIL FROM STORAGE:", email);

    try {
      const res = await fetch("http://127.0.0.1:8000/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      const data = await res.json();

      console.log("RESET RESPONSE:", data);

      if (!res.ok) {
        alert(data.detail || "Failed to reset password");
        return;
      }

      router.push("/reset-success");

    } catch (error) {
      console.error("Reset error:", error);
      alert("Backend server not reachable");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F4F4]">
      <div className="bg-white w-[420px] p-10 rounded-2xl shadow-lg">
        <h1 className="text-[28px] font-semibold text-[#111827] text-center">
          Reset Password
        </h1>

        <form onSubmit={handleSubmit}>
          <label className="text-[14px] font-medium">New Password</label>
          <input
            type="password"
            className="w-full mt-2 mb-6 px-4 py-3 border rounded-lg"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <label className="text-[14px] font-medium">Confirm Password</label>
          <input
            type="password"
            className="w-full mt-2 mb-6 px-4 py-3 border rounded-lg"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />

          <button
            type="submit"
            className="w-full bg-[#F2924E] text-white py-3 rounded-lg"
          >
            Reset Password
          </button>
        </form>
      </div>
    </div>
  );
}