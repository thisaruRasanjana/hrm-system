"use client";

import { useState, useEffect } from "react";
import { User, Upload } from "lucide-react";

export default function ProfileSettingsPage() {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    employee_id: "",
    department: "",
    email: "", // read-only based on the backend but we'll show it
    phone_number: "",
    address: "",
    date_of_birth: "",
    emergency_contact_number: "",
    profile_image_url: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch("http://127.0.0.1:8000/auth/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setFormData({
            first_name: data.first_name || "",
            last_name: data.last_name || "",
            employee_id: data.employee_id || "",
            department: data.department || "",
            email: data.email || "",
            phone_number: data.phone_number || "",
            address: data.address || "",
            date_of_birth: data.date_of_birth || "",
            emergency_contact_number: data.emergency_contact_number || "",
            profile_image_url: data.profile_image_url || "",
          });
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccessMsg("");

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("http://127.0.0.1:8000/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        setSuccessMsg("Profile updated successfully!");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        const errData = await res.json();
        setSuccessMsg(errData.detail || "Failed to update profile");
      }
    } catch (err) {
      console.error(err);
      setSuccessMsg("Network error saving profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    const data = new FormData();
    data.append("file", file);
    
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("http://127.0.0.1:8000/auth/profile/image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: data
      });
      
      if (res.ok) {
        const result = await res.json();
        setFormData({ ...formData, profile_image_url: result.profile_image_url });
        setSuccessMsg("Profile photo uploaded!");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setSuccessMsg("Failed to upload photo.");
      }
    } catch (err) {
      console.error(err);
      setSuccessMsg("Network error during upload.");
    }
  };

  return (
    <div className="w-full max-h-full">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Profile Information</h2>
        <p className="text-gray-400 text-sm font-medium">Update your personal profile picture</p>
      </div>

      <div className="mb-10">
        <p className="text-sm font-semibold text-gray-900 mb-4 tracking-wide">Profile photo</p>
        <div className="flex items-center gap-6">
          <div className="h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center text-gray-300 shadow-inner overflow-hidden border border-gray-200">
            {formData.profile_image_url ? (
               <img src={formData.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
               <User size={40} className="mt-2" />
            )}
          </div>
          <label className="flex items-center justify-center gap-2 bg-[#f08a4b] hover:bg-[#e07a3b] text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer">
            <Upload size={16} />
            Upload New Photo
            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
          </label>
        </div>
      </div>

      <form onSubmit={handleSave} className="border-t border-gray-100 pt-8 pb-10">
        <div className="grid grid-cols-2 gap-x-8 gap-y-6">
          {/* Row 1 */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2 tracking-wide">First Name:</label>
            <input 
              name="first_name"
              type="text" 
              value={formData.first_name}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-600 focus:outline-none focus:border-[#f08a4b] bg-white transition" 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2 tracking-wide">Last Name:</label>
            <input 
              name="last_name"
              type="text" 
              value={formData.last_name}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-600 focus:outline-none focus:border-[#f08a4b] bg-white transition" 
            />
          </div>

          {/* Row 2 */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2 tracking-wide">Employee ID:</label>
            <input 
              name="employee_id"
              type="text" 
              value={formData.employee_id}
              readOnly
              className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-500 bg-gray-50 cursor-not-allowed transition" 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2 tracking-wide">Department:</label>
            <input 
              name="department"
              type="text" 
              value={formData.department}
              readOnly
              className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-500 bg-gray-50 cursor-not-allowed transition" 
            />
          </div>

          {/* Row 3 */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2 tracking-wide">Email Address:</label>
            <input 
              name="email"
              type="email" 
              value={formData.email}
              readOnly
              className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-500 bg-gray-50 cursor-not-allowed transition" 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2 tracking-wide">Phone Number:</label>
            <input 
              name="phone_number"
              type="text" 
              value={formData.phone_number}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-600 focus:outline-none focus:border-[#f08a4b] bg-white transition" 
            />
          </div>

          {/* Row 4 - Full Width Address */}
          <div className="col-span-2">
            <label className="block text-sm font-bold text-gray-900 mb-2 tracking-wide">Address:</label>
            <input 
              name="address"
              type="text" 
              value={formData.address}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-600 focus:outline-none focus:border-[#f08a4b] bg-white transition" 
            />
          </div>

          {/* Row 5 */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2 tracking-wide">Date of Birth:</label>
            <input 
              name="date_of_birth"
              type="date" 
              value={formData.date_of_birth}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-600 focus:outline-none focus:border-[#f08a4b] bg-white transition" 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2 tracking-wide">Emergency Contact:</label>
            <input 
              name="emergency_contact_number"
              type="text" 
              value={formData.emergency_contact_number}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-600 focus:outline-none focus:border-[#f08a4b] bg-white transition" 
            />
          </div>
        </div>

        <div className="mt-12 flex items-center justify-end gap-4">
          {successMsg && <span className="text-green-600 text-sm font-medium">{successMsg}</span>}
          <button 
            type="submit"
            disabled={isLoading}
            className="bg-[#f08a4b] hover:bg-[#e07a3b] text-white px-8 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
