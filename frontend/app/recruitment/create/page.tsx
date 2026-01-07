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
      {/* Sidebar */}
      <aside className="w-64 bg-gray-50 border-r px-6 py-4">
        <h1 className="text-2xl font-bold mb-8">HRSM</h1>

        <nav className="space-y-4 text-gray-500">
          <div>Dashboard</div>
          <div className="text-orange-500 font-medium">Recruitment</div>
          <div>Document</div>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        {/* Header */}
        <h2 className="text-2xl font-semibold mb-6">
          Create New Vacancy
        </h2>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg border p-6 max-w-3xl"
        >
          {/* Position Title */}
          <div className="mb-4">
            <label className="block mb-1 font-medium">
              Position Title
            </label>
            <input
              type="text"
              placeholder="e.g. Senior Software Engineer"
              className="w-full border rounded px-3 py-2"
              value={form.title}
              onChange={(e) =>
                setForm({ ...form, title: e.target.value })
              }
              required
            />
          </div>

          {/* Department */}
          <div className="mb-4">
            <label className="block mb-1 font-medium">
              Department
            </label>
            <select
              className="w-full border rounded px-3 py-2"
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

          {/* Experience Level */}
          <div className="mb-4">
            <label className="block mb-2 font-medium">
              Experience Level
            </label>
            <div className="flex gap-3">
              {["Intern", "Junior", "Mid", "Senior"].map((level) => (
                <button
                  type="button"
                  key={level}
                  onClick={() =>
                    setForm({ ...form, experience_level: level })
                  }
                  className={`px-4 py-2 rounded border ${
                    form.experience_level === level
                      ? "bg-orange-400 text-white border-orange-400"
                      : "bg-white"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Job Description */}
          <div className="mb-4">
            <label className="block mb-1 font-medium">
              Job Description
            </label>
            <textarea
              placeholder="Describe the role and responsibilities..."
              className="w-full border rounded px-3 py-2 h-24"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>

          {/* Requirements (UI only) */}
          <div className="mb-6">
            <label className="block mb-1 font-medium">
              Requirements
            </label>
            <textarea
              placeholder="List required skills and qualifications..."
              className="w-full border rounded px-3 py-2 h-24"
              disabled
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.push("/recruitment")}
              className="px-6 py-2 border border-orange-400 text-orange-400 rounded-lg"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-6 py-2 bg-orange-400 hover:bg-orange-500 text-white rounded-lg"
            >
              Create Vacancy
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}