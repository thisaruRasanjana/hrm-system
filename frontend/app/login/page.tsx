"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthLayout from "@/components/auth/AuthLayout";
import { useAuth } from "@/context/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [show2FA, setShow2FA] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("http://127.0.0.1:8000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      let data;

      try {
        data = await res.json();
      } catch {
        throw new Error("Invalid server response");
      }

      if (res.ok && data.require_2fa) {
        setTempToken(data.temp_token);
        setShow2FA(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setErrorMsg(data.detail || "Invalid email or password");
        setLoading(false);
        return;
      }

      // Use AuthContext login to set token and fetch user data immediately
      await login(data.access_token);

      router.push("/dashboard");

    } catch (error) {
      console.error("Login error:", error);
      setErrorMsg("Login failed. Please check backend connection.");
    }

    setLoading(false);
  };

  const handle2FASubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("http://127.0.0.1:8000/auth/login/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temp_token: tempToken, code: otpCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.detail || "Invalid 2FA code");
        setLoading(false);
        return;
      }

      // Use AuthContext login for 2FA as well
      await login(data.access_token);

      router.push("/dashboard");
    } catch (error) {
      console.error("2FA error:", error);
      setErrorMsg("Verification failed.");
    }
    setLoading(false);
  };

  return (
    <AuthLayout
      title="Welcome Back"
      description="Sign in to your HRMS account"
    >
      {!show2FA ? (
        <form onSubmit={handleLogin}>
          {errorMsg && (
            <div className="bg-red-50 text-red-500 text-sm font-medium p-3 rounded-lg mb-4 text-center">
              {errorMsg}
            </div>
          )}

          <label className="block text-[16px] font-medium text-[#364153] mb-2">
            Email or Username
          </label>

          <input
            type="text"
            placeholder="Enter your email or username"
            className="w-full mb-6 px-4 py-3 border border-gray-300 rounded-lg
            text-[#1E293B] placeholder-[#D1D5DC]
            focus:outline-none focus:ring-2 focus:ring-[#F2924E]"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            required
          />

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
            onChange={(e)=>setPassword(e.target.value)}
            required
          />

          <p
            className="text-right text-[14px] text-[#F2924E] cursor-pointer mb-6"
            onClick={()=>router.push("/forgot-password")}
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
      ) : (
        <form onSubmit={handle2FASubmit}>
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Two-Factor Authentication</h3>
            <p className="text-sm text-gray-500">Enter the 6-digit code from your authenticator app to continue.</p>
          </div>
          
          {errorMsg && (
            <div className="bg-red-50 text-red-500 text-sm font-medium p-3 rounded-lg mb-4 text-center">
              {errorMsg}
            </div>
          )}
          
          <label className="block text-[16px] font-medium text-[#364153] mb-2">
            Verification Code
          </label>

          <input
            type="text"
            placeholder="000000"
            className="w-full mb-6 px-4 py-3 border border-gray-300 rounded-lg
            text-center text-2xl tracking-widest text-[#1E293B] placeholder-[#D1D5DC]
            focus:outline-none focus:ring-2 focus:ring-[#F2924E]"
            value={otpCode}
            onChange={(e)=>setOtpCode(e.target.value)}
            required
            maxLength={6}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#F2924E] hover:bg-[#e07f3f] text-white py-3 rounded-lg text-[18px] font-semibold transition"
          >
            {loading ? "Verifying..." : "Verify Code"}
          </button>
          
          <p
            className="text-center text-[14px] text-gray-500 cursor-pointer mt-6 underline"
            onClick={()=> setShow2FA(false)}
          >
            Back to login
          </p>
        </form>
      )}
    </AuthLayout>
  );
}