"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../../components/Sidebar";
import TopBar from "../../../components/Topbar";
import { IconChevron } from "../../../components/Icons";

const inputCls =
  "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition";

type User = {
  id: number;
  first_name: string;
  last_name: string;
};

function EmployeeSearch({
  users,
  onSelect,
  placeholder,
}: {
  users: User[];
  onSelect: (id: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = users.filter((u) =>
    `${u.first_name} ${u.last_name}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        placeholder={placeholder}
        className={inputCls}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />

      {open && filtered.length > 0 && (
        <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-xl mt-2 max-h-52 overflow-y-auto shadow-lg">
          {filtered.map((u) => (
            <div
              key={u.id}
              onClick={() => {
                onSelect(String(u.id));
                setQuery(`${u.first_name} ${u.last_name}`);
                setOpen(false);
              }}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 cursor-pointer"
            >
              {u.first_name} {u.last_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VacancyCreatePage() {
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  const [form, setForm] = useState({
    title: "",
    department: "",
    experience_level: "",
    description: "",
    requirements: "",
    required_skills: "",
    status: "Draft",
  });

  const [panel, setPanel] = useState({
    panel_head_id: "",
    panel_member_1_id: "",
    panel_member_2_id: "",
    interview_link: "",
  });

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/employees/`);
        const data = await res.json();

        if (Array.isArray(data)) setUsers(data);
        else setUsers([]);
      } catch (err) {
        console.error("Failed to load employees", err);
        setUsers([]);
      }
    };

    loadEmployees();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const vacancyRes = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/vacancies`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      }
    );

    const vacancy = await vacancyRes.json();
    const vacancyId = vacancy.id;

    if (panel.panel_head_id && panel.interview_link) {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/vacancies/${vacancyId}/panel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            panel_head_id: Number(panel.panel_head_id),
            panel_member_1_id: panel.panel_member_1_id
              ? Number(panel.panel_member_1_id)
              : null,
            panel_member_2_id: panel.panel_member_2_id
              ? Number(panel.panel_member_2_id)
              : null,
            interview_link: panel.interview_link,
          }),
        }
      );
    }

    router.push("/recruitment");
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar activePath="/recruitment" />

      <div className="flex-1 flex flex-col">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Create New Vacancy
          </h2>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Position Title */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Position Title
                </label>
                <input
                  type="text"
                  placeholder="Senior Software Engineer"
                  className={inputCls}
                  value={form.title}
                  onChange={(e) =>
                    setForm({ ...form, title: e.target.value })
                  }
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
                  placeholder="IT / HR / Finance"
                  className={inputCls}
                  value={form.department}
                  onChange={(e) =>
                    setForm({ ...form, department: e.target.value })
                  }
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
                      onClick={() =>
                        setForm({ ...form, experience_level: level })
                      }
                      className={`py-3 rounded-xl border text-sm font-medium ${
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
                  className={`${inputCls} h-32`}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>

              {/* Requirements */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Requirements
                </label>
                <textarea
                  className={`${inputCls} h-32`}
                  value={form.requirements}
                  onChange={(e) =>
                    setForm({ ...form, requirements: e.target.value })
                  }
                />
              </div>

              {/* Required Skills */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Required Skills <span className="text-gray-400 font-normal">(e.g. Python, React, SQL)</span>
                </label>
                <textarea
                  className={`${inputCls} h-24`}
                  value={form.required_skills}
                  onChange={(e) =>
                    setForm({ ...form, required_skills: e.target.value })
                  }
                  placeholder="Comma-separated important skills for matching..."
                />
              </div>

              {/* Status */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Status
                </label>

                <div className="relative w-full">
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                    className="w-full appearance-none bg-white border border-gray-200 rounded-xl pl-4 pr-9 py-3 text-sm text-gray-700 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition"
                    required
                  >
                    <option value="Draft">Draft</option>
                    <option value="Active">Active</option>
                    <option value="Closed">Closed</option>
                  </select>

                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <IconChevron />
                  </span>
                </div>
              </div>

              {/* Interview Panel */}
              <div className="border border-gray-200 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPanelOpen(!panelOpen)}
                  className="w-full flex justify-between items-center px-4 py-3 text-sm font-medium text-gray-700"
                >
                  Interview Panel (Optional)
                  <span>{panelOpen ? "−" : "+"}</span>
                </button>

                {panelOpen && (
                  <div className="p-6 border-t border-gray-200 space-y-4">

                    <EmployeeSearch
                      users={users}
                      onSelect={(id) =>
                        setPanel({ ...panel, panel_head_id: id })
                      }
                      placeholder="Search panel head"
                    />

                    <EmployeeSearch
                      users={users}
                      onSelect={(id) =>
                        setPanel({ ...panel, panel_member_1_id: id })
                      }
                      placeholder="Search panel member"
                    />

                    <EmployeeSearch
                      users={users}
                      onSelect={(id) =>
                        setPanel({ ...panel, panel_member_2_id: id })
                      }
                      placeholder="Search panel member"
                    />

                    <input
                      type="text"
                      placeholder="Interview Link (Google Meet / Cita)"
                      className={inputCls}
                      value={panel.interview_link}
                      onChange={(e) =>
                        setPanel({
                          ...panel,
                          interview_link: e.target.value,
                        })
                      }
                    />
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => router.push("/recruitment")}
                  className="px-8 py-3 border border-orange-400 text-orange-500 rounded-xl"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-8 py-3 bg-orange-400 hover:bg-orange-500 text-white rounded-xl"
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