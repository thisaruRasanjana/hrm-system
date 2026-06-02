"use client";

import { useRouter } from "next/navigation";
import AuthLayout from "@/components/auth/AuthLayout";

export default function ResetSuccess() {

  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F4F4]">

      <div className="bg-white w-[420px] p-10 rounded-2xl shadow-xl text-center">

        <div className="mb-6 text-green-500 text-5xl">✓</div>

        <h1 className="text-[22px] font-semibold text-[#111827]">
          Password Reset Successful!
        </h1>

        <p className="text-[14px] text-[#6B7280] mt-3 mb-8">
          Your password has been successfully reset. You can now log in with your new password.
        </p>

        <button
          onClick={() => router.push("/login")}
          className="w-full bg-[#F2924E] hover:bg-[#e07f3f] text-white py-3 rounded-lg text-[16px] font-semibold"
        >
          Return to Login
        </button>

      </div>

      <p className="text-[12px] text-[#6B7280] mt-8 text-center">
        If you didn't request this change, please contact your administrator immediately.
      </p>

    </div>
  );
}