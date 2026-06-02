"use client";

import { useState, useEffect } from "react";
import { User, Upload, Mail, Hash, Briefcase } from "lucide-react";
import { apiFetch, getToken } from "@/lib/api";

export default function ProfileSettingsPage() {

  const [formData, setFormData] = useState({
    // Editable
    first_name: "",
    last_name: "",
    phone_number: "",
    address: "",
    date_of_birth: "",
    gender: "",
    marital_status: "",
    nationality: "",
    emergency_contact_name: "",
    emergency_contact_number: "", // Legacy User field mapped to phone
    emergency_contact_relation: "",
    bank_name: "",
    bank_account_no: "",
    bank_branch: "",
    skills: "",
    qualifications: "",
    // Read-only display
    employee_id: "",
    department: "",
    email: "",
    profile_image_url: "",
    designation: "",
    joined_date: "",
    status: "",
    role: "", // Wait, Role is also read-only
  });

  const [isLoading, setIsLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await apiFetch("/auth/me");
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
            gender: data.gender || "",
            marital_status: data.marital_status || "",
            nationality: data.nationality || "",
            emergency_contact_name: data.emergency_contact_name || "",
            emergency_contact_number: data.emergency_contact_number || "",
            emergency_contact_relation: data.emergency_contact_relation || "",
            bank_name: data.bank_name || "",
            bank_account_no: data.bank_account_no || "",
            bank_branch: data.bank_branch || "",
            skills: data.skills || "",
            qualifications: data.qualifications || "",
            profile_image_url: data.profile_image_url || "",
            designation: data.designation || "",
            joined_date: data.joined_date || "",
            status: data.status || "",
            role: data.role || "",
          });
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMsg({ text: "", type: "" });

    // Only send editable fields
    const payload = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      phone_number: formData.phone_number,
      address: formData.address,
      date_of_birth: formData.date_of_birth,
      gender: formData.gender,
      marital_status: formData.marital_status,
      nationality: formData.nationality,
      emergency_contact_name: formData.emergency_contact_name,
      emergency_contact_number: formData.emergency_contact_number,
      emergency_contact_relation: formData.emergency_contact_relation,
      bank_name: formData.bank_name,
      bank_account_no: formData.bank_account_no,
      bank_branch: formData.bank_branch,
      skills: formData.skills,
      qualifications: formData.qualifications,
    };

    try {
      const res = await apiFetch("/auth/profile", {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setMsg({ text: "Profile updated successfully!", type: "success" });
        setTimeout(() => setMsg({ text: "", type: "" }), 3500);
      } else {
        const errData = await res.json();
        setMsg({ text: errData.detail || "Failed to update profile", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setMsg({ text: "Network error saving profile", type: "error" });
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
      const token = getToken();
      const res = await fetch("http://127.0.0.1:8000/auth/profile/image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: data
      });

      if (res.ok) {
        const result = await res.json();
        setFormData(prev => ({ ...prev, profile_image_url: result.profile_image_url }));
        setMsg({ text: "Profile photo uploaded!", type: "success" });
        setTimeout(() => setMsg({ text: "", type: "" }), 3000);
      } else {
        setMsg({ text: "Failed to upload photo.", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setMsg({ text: "Network error during upload.", type: "error" });
    }
  };

  const inputClass = "w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#f08a4b] bg-white transition";
  const labelClass = "block text-sm font-bold text-gray-700 mb-2";
  const readOnlyClass = "w-full border border-gray-100 rounded-xl p-3 text-sm text-gray-400 bg-gray-50 cursor-not-allowed";

  return (
    <div className="w-full max-h-full pb-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Personal Information</h2>
        <p className="text-gray-400 text-sm font-medium">Update your personal details and profile photo.</p>
      </div>

      <div className="space-y-6">
          {msg.text && (
            <div className={`p-4 rounded-xl text-sm font-medium border ${msg.type === "success" ? "bg-green-50 border-green-100 text-green-700" : "bg-red-50 border-red-100 text-red-600"}`}>
              {msg.text}
            </div>
          )}

          {/* Avatar */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-6">
            <div className="h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center text-gray-300 shadow-inner overflow-hidden border border-gray-200 shrink-0">
              {formData.profile_image_url ? (
                <img src={formData.profile_image_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={40} className="mt-2 text-gray-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{formData.first_name} {formData.last_name}</h3>
              <div className="flex flex-wrap gap-3 text-sm text-gray-400 mb-3">
                {formData.employee_id && <span className="flex items-center gap-1"><Hash size={13}/> {formData.employee_id}</span>}
                {formData.department && <span className="flex items-center gap-1"><Briefcase size={13}/> {formData.department}</span>}
                {formData.email && <span className="flex items-center gap-1"><Mail size={13}/> {formData.email}</span>}
              </div>
              <label className="inline-flex items-center gap-2 bg-[#f08a4b] hover:bg-[#e07a3b] text-white px-5 py-2 rounded-lg text-sm font-semibold transition cursor-pointer">
                <Upload size={15} />
                Upload New Photo
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-8">
            
            {/* Work Information (Read Only) */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <h3 className="text-base font-bold text-gray-900 mb-6">Work Information <span className="text-gray-400 font-normal text-xs ml-2">(Admin assigned - Read Only)</span></h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                <div>
                  <label className={labelClass}>Employee ID</label>
                  <input type="text" value={formData.employee_id} readOnly className={readOnlyClass} />
                </div>
                <div>
                  <label className={labelClass}>Email Address</label>
                  <input type="email" value={formData.email} readOnly className={readOnlyClass} />
                </div>
                <div>
                  <label className={labelClass}>Department</label>
                  <input type="text" value={formData.department} readOnly className={readOnlyClass} />
                </div>
                <div>
                  <label className={labelClass}>Role</label>
                  <input type="text" value={formData.role} readOnly className={readOnlyClass} />
                </div>
                <div>
                  <label className={labelClass}>Designation</label>
                  <input type="text" value={formData.designation} readOnly className={readOnlyClass} />
                </div>
                <div>
                  <label className={labelClass}>Joined Date</label>
                  <input type="text" value={formData.joined_date} readOnly className={readOnlyClass} />
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <h3 className="text-base font-bold text-gray-900 mb-6">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                <div>
                  <label className={labelClass}>First Name</label>
                  <input name="first_name" type="text" value={formData.first_name} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Last Name</label>
                  <input name="last_name" type="text" value={formData.last_name} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Phone Number</label>
                  <input name="phone_number" type="text" value={formData.phone_number} onChange={handleChange} placeholder="+1 (555) 000-0000" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Date of Birth</label>
                  <input name="date_of_birth" type="date" value={formData.date_of_birth} onChange={handleChange} className={inputClass} />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className={labelClass}>Home Address</label>
                  <input name="address" type="text" value={formData.address} onChange={handleChange} placeholder="Enter your full address" className={inputClass} />
                </div>
              </div>
            </div>

            {/* Personal Details */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <h3 className="text-base font-bold text-gray-900 mb-6">Personal Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                <div>
                  <label className={labelClass}>Gender</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} className={inputClass}>
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Marital Status</label>
                  <select name="marital_status" value={formData.marital_status} onChange={handleChange} className={inputClass}>
                    <option value="">Select status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Nationality</label>
                  <input name="nationality" type="text" value={formData.nationality} onChange={handleChange} placeholder="e.g. Sri Lankan" className={inputClass} />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <h3 className="text-base font-bold text-gray-900 mb-6">Emergency Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                <div>
                  <label className={labelClass}>Contact Name</label>
                  <input name="emergency_contact_name" type="text" value={formData.emergency_contact_name} onChange={handleChange} placeholder="Contact name" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Relationship</label>
                  <input name="emergency_contact_relation" type="text" value={formData.emergency_contact_relation} onChange={handleChange} placeholder="e.g. Spouse, Parent" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Contact Phone</label>
                  <input name="emergency_contact_number" type="text" value={formData.emergency_contact_number} onChange={handleChange} placeholder="Emergency phone number" className={inputClass} />
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <h3 className="text-base font-bold text-gray-900 mb-6">Bank Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                <div>
                  <label className={labelClass}>Bank Name</label>
                  <input name="bank_name" type="text" value={formData.bank_name} onChange={handleChange} placeholder="Bank name" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Account Number</label>
                  <input name="bank_account_no" type="text" value={formData.bank_account_no} onChange={handleChange} placeholder="Account number" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Branch Name</label>
                  <input name="bank_branch" type="text" value={formData.bank_branch} onChange={handleChange} placeholder="Branch name" className={inputClass} />
                </div>
              </div>
            </div>

            {/* Skills & Qualifications */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <h3 className="text-base font-bold text-gray-900 mb-6">Skills & Qualifications</h3>
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Skills</label>
                  <textarea name="skills" value={formData.skills} onChange={handleChange} placeholder="List skills separated by commas (e.g., JavaScript, React, SQL)" className={`${inputClass} min-h-[100px] resize-none`} />
                </div>
                <div>
                  <label className={labelClass}>Qualifications</label>
                  <textarea name="qualifications" value={formData.qualifications} onChange={handleChange} placeholder="Enter educational qualifications and certifications" className={`${inputClass} min-h-[100px] resize-none`} />
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-[#f08a4b] hover:bg-[#e07a3b] text-white px-8 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50 shadow-md shadow-orange-100"
              >
                {isLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
      </div>
    </div>
  );
}
