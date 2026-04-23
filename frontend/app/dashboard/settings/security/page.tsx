"use client";

import { useState, useEffect } from "react";
import { Lock, Smartphone, Globe } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function SecuritySettingsPage() {
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);
  const [passMsg, setPassMsg] = useState("");

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [setupData, setSetupData] = useState<{secret: string; qr_code_url: string}|null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [tfaMsg, setTfaMsg] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await apiFetch("/auth/me");
        if (res.ok) {
          const data = await res.json();
          setTwoFactorEnabled(data.two_factor_enabled);
        }
      } catch (err) {}
    };
    fetchUser();
  }, []);

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      setPassMsg("New passwords do not match!");
      return;
    }
    setIsUpdatingPass(true);
    setPassMsg("");

    try {
      const res = await apiFetch("/auth/security/password", {
        method: "PUT",
        body: JSON.stringify({
          current_password: passwords.current,
          new_password: passwords.new
        })
      });

      if (res.ok) {
        setPassMsg("Password updated successfully.");
        setPasswords({ current: "", new: "", confirm: "" });
        setTimeout(() => setPassMsg(""), 3000);
      } else {
        const errData = await res.json();
        setPassMsg(errData.detail || "Failed to update password");
      }
    } catch (err) {
      console.error(err);
      setPassMsg("Network error trying to change password.");
    } finally {
      setIsUpdatingPass(false);
    }
  };

  const handleEnableClick = async () => {
    try {
      setTfaMsg("");
      const res = await apiFetch("/auth/security/2fa/setup");
      if (res.ok) {
        const data = await res.json();
        setSetupData(data);
        setIsSettingUp(true);
      } else {
        setTfaMsg("Failed to start 2FA setup");
      }
    } catch (err) {
      setTfaMsg("Network error");
    }
  };

  const verifyAndEnable = async () => {
    try {
      setTfaMsg("");
      const res = await apiFetch("/auth/security/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ code: verifyCode })
      });
      if (res.ok) {
        setTwoFactorEnabled(true);
        setIsSettingUp(false);
        setSetupData(null);
        setVerifyCode("");
      } else {
        const err = await res.json();
        setTfaMsg(err.detail || "Invalid code");
      }
    } catch (err) {
      setTfaMsg("Network error");
    }
  };

  const handleDisableClick = async () => {
    try {
      const res = await apiFetch("/auth/security/2fa", { method: "DELETE" });
      if (res.ok) {
        setTwoFactorEnabled(false);
      }
    } catch (err) {}
  };

  return (
    <div className="w-full max-h-full pb-10">
      
      {/* Change Password Section */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <Lock size={20} className="text-gray-800" />
          <h2 className="text-xl font-bold text-gray-900">Change Password</h2>
        </div>
        <p className="text-gray-400 text-sm font-medium ml-8 mb-6">Update your password regularly to keep your account secure</p>
        
        <form onSubmit={handlePasswordSave} className="ml-8 space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2 tracking-wide">Current Password:</label>
            <input 
              type="password"
              value={passwords.current}
              onChange={(e) => setPasswords({...passwords, current: e.target.value})}
              required
              className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:outline-none focus:border-[#f08a4b] bg-white transition" 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2 tracking-wide">New Password:</label>
            <input 
              type="password"
              value={passwords.new}
              onChange={(e) => setPasswords({...passwords, new: e.target.value})}
              required
              className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:outline-none focus:border-[#f08a4b] bg-white transition" 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2 tracking-wide">Confirm Password:</label>
            <input 
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
              required
              className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:outline-none focus:border-[#f08a4b] bg-white transition" 
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-4">
            {passMsg && <span className={`text-sm font-medium ${passMsg.includes("match") ? "text-red-500" : "text-green-600"}`}>{passMsg}</span>}
            <button 
              type="submit"
              disabled={isUpdatingPass}
              className="bg-[#f08a4b] hover:bg-[#e07a3b] text-white px-8 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              {isUpdatingPass ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>

      <hr className="border-gray-100 my-10" />

      {/* Two-Factor Authentication Section */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <Smartphone size={20} className="text-gray-800" />
          <h2 className="text-xl font-bold text-gray-900">Two-Factor Authentication</h2>
        </div>
        <p className="text-gray-400 text-sm font-medium ml-8 mb-6">Add an extra layer of security to your account</p>
        
        {!isSettingUp ? (
          <div className="ml-8 border border-gray-200 rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-gray-100 text-[#f08a4b] rounded-full flex items-center justify-center font-bold text-sm">
                2FA
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-sm mb-0.5">Status: {twoFactorEnabled ? "Enabled" : "Disabled"}</h4>
                <p className="text-xs text-gray-400 font-medium tracking-wide">Protect your account with 2FA</p>
              </div>
            </div>
            {twoFactorEnabled ? (
              <button 
                onClick={handleDisableClick}
                className="px-8 py-2.5 rounded-lg text-sm font-semibold transition bg-gray-200 hover:bg-gray-300 text-gray-700"
              >
                Disable
              </button>
            ) : (
              <button 
                onClick={handleEnableClick}
                className="px-8 py-2.5 rounded-lg text-sm font-semibold transition bg-[#f08a4b] hover:bg-[#e07a3b] text-white"
              >
                Enable
              </button>
            )}
          </div>
        ) : (
          <div className="ml-8 border border-gray-200 rounded-xl p-6 bg-gray-50/50">
            <h3 className="font-bold text-gray-900 mb-2">Configure Authenticator App</h3>
            <p className="text-sm text-gray-500 mb-4">
              Scan the QR code below with Google Authenticator or Authy, then enter the 6-digit code.
            </p>
            {setupData && (
              <div className="flex gap-6 mb-4">
                <img src={setupData.qr_code_url} alt="QR Code" className="w-32 h-32 rounded-lg" />
                <div className="flex flex-col justify-center">
                  <p className="text-sm font-medium text-gray-700 mb-2">Or enter this secret manually:</p>
                  <code className="bg-white px-3 py-1 border border-gray-200 rounded text-[#f08a4b] font-mono tracking-widest">{setupData.secret}</code>
                </div>
              </div>
            )}
            <div className="flex items-center gap-4 mb-2">
              <input
                type="text"
                placeholder="000 000"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                maxLength={6}
                className="w-40 border border-gray-200 rounded-lg p-2.5 text-center tracking-widest text-[#1F2937] focus:outline-none focus:border-[#f08a4b] transition"
              />
              <button 
                onClick={verifyAndEnable}
                className="bg-[#f08a4b] hover:bg-[#e07a3b] text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition"
              >
                Verify & Enable
              </button>
              <button 
                onClick={() => { setIsSettingUp(false); setSetupData(null); setTfaMsg(""); }}
                className="text-gray-500 hover:text-gray-700 text-sm font-semibold transition ml-2"
              >
                Cancel
              </button>
            </div>
            {tfaMsg && <p className="text-red-500 text-sm font-medium">{tfaMsg}</p>}
          </div>
        )}
      </div>

      <hr className="border-gray-100 my-10" />

      {/* Active Sessions Section */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Globe size={20} className="text-gray-800" />
          <h2 className="text-xl font-bold text-gray-900">Active Sessions</h2>
        </div>
        <p className="text-gray-400 text-sm font-medium ml-8 mb-6">Manage your active login sessions</p>

        <div className="ml-8 space-y-4">
          
          {/* Session 1 */}
          <div className="border border-gray-200 rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-[#f08a4b] text-white rounded-full flex items-center justify-center font-bold text-[13px]">
                CW
              </div>
              <div>
                <div className="flex items-center gap-3 mb-0.5">
                  <h4 className="font-bold text-gray-900 text-sm">Chrome on Windows</h4>
                  <span className="bg-[#f08a4b] text-white text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full">Current</span>
                </div>
                <p className="text-xs text-gray-400 font-medium tracking-wide">Colombo • Sri Lanka • Last seen: Just now</p>
              </div>
            </div>
          </div>

          {/* Session 2 */}
          <div className="border border-gray-200 rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center font-bold text-[13px]">
                SI
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-sm mb-0.5">Safari on iPhone</h4>
                <p className="text-xs text-gray-400 font-medium tracking-wide">Colombo • Sri Lanka • Last seen: 2 days ago</p>
              </div>
            </div>
            <button className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-2 rounded-lg text-sm font-semibold transition">
              Revoke
            </button>
          </div>

        </div>

        <button className="ml-8 mt-6 text-[#f08a4b] hover:text-[#e07a3b] text-sm font-semibold transition">
          Sign out of all other sessions
        </button>
      </div>

    </div>
  );
}
