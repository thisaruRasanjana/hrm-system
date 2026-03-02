"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/Topbar";

const inputCls =
  "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition";

export default function VacancyCreatePage() {
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    department: "",
    experience_level: "",
    description: "",
    requirements: "",
    status: "",
    applicants: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await fetch("http://127.0.0.1:8000/recruitment/vacancies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    router.push("/recruitment");
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar activePath="/recruitment" />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Vacancy</h2>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Position Title */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Position Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Software Engineer"
                  className={inputCls}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              {/* Department */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Department
                </label>
                <input
                  type="text"
                  placeholder="e.g. IT, HR, Finance"
                  className={inputCls}
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  required
                />
              </div>

              {/* Experience Level */}
              <div>
                <label className="block mb-3 text-sm font-medium text-gray-700">
                  Experience Level
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {["Intern", "Junior", "Mid", "Senior"].map((level) => (
                    <button
                      type="button"
                      key={level}
                      onClick={() => setForm({ ...form, experience_level: level })}
                      className={`py-3 rounded-xl border text-sm font-medium transition-colors ${
                        form.experience_level === level
                          ? "bg-orange-400 text-white border-orange-400"
                          : "bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-500"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Job Description */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Job Description
                </label>
                <textarea
                  placeholder="Describe the role and responsibilities..."
                  className={`${inputCls} h-32 resize-none`}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              {/* Requirements */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Requirements
                </label>
                <textarea
                  placeholder="List required skills and qualifications..."
                  className={`${inputCls} h-32 resize-none`}
                  value={form.requirements}
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                />
              </div>

              {/* Status */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Status
                </label>
                <div className="relative">
                  <select
                    className={`${inputCls} appearance-none pr-10`}
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    required
                  >
                    <option value=""></option>
                    <option value="Active">Active</option>
                    <option value="Closed">Closed</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => router.push("/recruitment")}
                  className="px-8 py-3 border border-orange-400 text-orange-500 rounded-xl text-sm font-medium hover:bg-orange-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-orange-400 hover:bg-orange-500 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Create Vacancy
                </button>
              </div>

            </form>
          </div>
        </main>
      </div>
    </div>
  );
}