"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VacancyCreatePage() {
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    department: "",
    experience_level: "",
    description: "",
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
    <div className="flex min-h-screen bg-gray-100">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#F3F3F3] border-r border-gray-200 px-6 py-8">
        <h1 className="text-2xl font-bold mb-10 tracking-wide">
          HRSM
        </h1>

        <p className="text-xs text-gray-400 tracking-widest mb-6">
          MAIN MENU
        </p>

        <nav className="space-y-6 text-gray-500 text-base">
          <div className="cursor-pointer">Dashboard</div>
          <div className="text-orange-500 font-semibold">Recruitment</div>
          <div className="cursor-pointer">Document</div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-10">
        {/* PAGE TITLE */}
        <h2 className="text-3xl font-semibold text-gray-800 mb-8">
          Create New Vacancy
        </h2>

        {/* FORM CARD */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-3xl"
        >
          {/* POSITION TITLE */}
          <div className="mb-6">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Position Title
            </label>
            <input
              type="text"
              placeholder="e.g. Senior Software Engineer"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
              value={form.title}
              onChange={(e) =>
                setForm({ ...form, title: e.target.value })
              }
              required
            />
          </div>

          {/* DEPARTMENT */}
          <div className="mb-6">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Department
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
              value={form.department}
              onChange={(e) =>
                setForm({ ...form, department: e.target.value })
              }
              required
            >
              <option value="">Select Department</option>
              <option value="IT">IT</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
            </select>
          </div>

          {/* EXPERIENCE LEVEL */}
          <div className="mb-6">
            <label className="block mb-3 text-sm font-medium text-gray-700">
              Experience Level
            </label>
            <div className="flex gap-4">
              {["Intern", "Junior", "Mid", "Senior"].map((level) => (
                <button
                  type="button"
                  key={level}
                  onClick={() =>
                    setForm({ ...form, experience_level: level })
                  }
                  className={`px-5 py-2 rounded-lg border text-sm ${
                    form.experience_level === level
                      ? "bg-orange-400 text-white border-orange-400"
                      : "bg-white text-gray-700 border-gray-300 hover:border-orange-300"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* JOB DESCRIPTION */}
          <div className="mb-6">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Job Description
            </label>
            <textarea
              placeholder="Describe the role and responsibilities..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-orange-200"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>

          {/* REQUIREMENTS (UI ONLY) */}
          <div className="mb-8">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Requirements
            </label>
            <textarea
              placeholder="List required skills and qualifications..."
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm h-28 resize-none bg-gray-50 text-gray-400"
              disabled
            />
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex gap-5">
            <button
              type="button"
              onClick={() => router.push("/recruitment")}
              className="px-8 py-3 border border-orange-400 text-orange-500 rounded-xl text-sm font-medium hover:bg-orange-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-8 py-3 bg-orange-400 hover:bg-orange-500 text-white rounded-xl text-sm font-medium"
            >
              Create Vacancy
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}