"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/auth/login", {
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

      if (!res.ok) {
        alert(data.detail || "Invalid email or password");
        setLoading(false);
        return;
      }

      // Save tokens
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);

      router.push("/dashboard");

    } catch (error) {
      console.error("Login error:", error);
      alert("Backend server not reachable.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F4F4]">
      <form
        onSubmit={handleLogin}
        className="bg-white p-10 rounded-2xl shadow-xl w-[420px]"
      >
        <h1 className="text-[32px] font-bold text-[#1E293B] text-center">
          Welcome Back
        </h1>

        <p className="text-[16px] text-[#64748B] text-center mt-2 mb-8">
          Sign in to your HRMS account
        </p>

        {/* Email */}
        <label className="block text-[16px] font-medium text-[#364153] mb-2">
          Email
        </label>

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

        {/* Password */}
        <label className="block text-[16px] font-medium text-[#364153] mb-2">
          Password
        </label>

        <input
          type="password"
          placeholder="Enter your password"
          className="w-full mb-2 px-4 py-3 border border-gray-300 rounded-lg 
          text-[#1E293B] placeholder-[#D1D5DC]
          focus:outline-none focus:ring-2 focus:ring-[#F2924E]"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <p
          className="text-right text-[14px] text-[#F2924E] cursor-pointer mb-6"
          onClick={() => router.push("/forgot-password")}
        >
          Forgot Password?
        </p>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#F2924E] hover:bg-[#e07f3f] text-white py-3 rounded-lg text-[18px] font-semibold transition"
        >
          {loading ? "Logging in..." : "Log In"}
        </button>

        <p className="text-[13px] text-center text-[#64748B] mt-6">
          By continuing, you agree to our{" "}
          <span className="text-[#F2924E] cursor-pointer">
            Terms of Use
          </span>{" "}
          and{" "}
          <span className="text-[#F2924E] cursor-pointer">
            Privacy Policy
          </span>
        </p>
      </form>
    </div>
  );
}