"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";
import { IconChevron } from "@/components/Icons";
import RichTextEditor from "@/components/RichTextEditor";

const inputCls =
  "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition";

type Vacancy = {
  id: number;
  title: string;
  department: string;
  experience_level: string | null;
  description: string | null;
  requirements: string | null;
  required_skills: string | null;  // kept for DB compat — no longer shown in UI
  status: string;
};

type Panel = {
  panel_head_id: number | null;
  panel_member_1_id: number | null;
  panel_member_2_id: number | null;
  interview_link: string | null;
};

type User = {
  id: number;
  first_name: string;
  last_name: string;
};

// Searchable employee autocomplete — identical to create page
function EmployeeSearch({
  users,
  onSelect,
  placeholder,
  initialName,
}: {
  users: User[];
  onSelect: (id: string) => void;
  placeholder: string;
  initialName?: string;
}) {
  const [query, setQuery] = useState(initialName ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update displayed name when initial data loads
  useEffect(() => {
    if (initialName) setQuery(initialName);
  }, [initialName]);

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
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

export default function EditVacancyPage() {
  const params = useParams();
  const router = useRouter();
  const vacancyId = params.id as string;

  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [form, setForm] = useState({
    description: "",
    requirements: "",
    status: "Active",
  });

  // Panel fields — pre-filled after load
  const [panel, setPanel] = useState<{
    panel_head_id: string;
    panel_member_1_id: string;
    panel_member_2_id: string;
    interview_link: string;
  }>({
    panel_head_id: "",
    panel_member_1_id: "",
    panel_member_2_id: "",
    interview_link: "",
  });

  // Names for pre-filling EmployeeSearch fields
  const [panelNames, setPanelNames] = useState({
    head: "",
    member1: "",
    member2: "",
  });

  useEffect(() => {
    if (!vacancyId) return;

    const loadData = async () => {
      try {
        // Fetch vacancy details
        const vRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/vacancies/${vacancyId}`
        );
        if (!vRes.ok) throw new Error("Vacancy not found");
        const v: Vacancy = await vRes.json();
        setVacancy(v);
        setForm({
          description: v.description ?? "",
          requirements: v.requirements ?? "",
          status: v.status ?? "Active",
        });

        // Fetch employees for panel search
        const empRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/employees/`);
        const empData = await empRes.json();
        const empList: User[] = Array.isArray(empData) ? empData : [];
        setUsers(empList);

        // Fetch existing panel (may return 404 — that's fine)
        const panelRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/vacancies/${vacancyId}/panel`
        );

        if (panelRes.ok) {
          const p: Panel = await panelRes.json();
          setPanel({
            panel_head_id: p.panel_head_id ? String(p.panel_head_id) : "",
            panel_member_1_id: p.panel_member_1_id
              ? String(p.panel_member_1_id)
              : "",
            panel_member_2_id: p.panel_member_2_id
              ? String(p.panel_member_2_id)
              : "",
            interview_link: p.interview_link ?? "",
          });

          // Resolve names for the search fields
          const getName = (id: number | null) => {
            if (!id) return "";
            const emp = empList.find((e) => e.id === id);
            return emp ? `${emp.first_name} ${emp.last_name}` : "";
          };

          setPanelNames({
            head: getName(p.panel_head_id),
            member1: getName(p.panel_member_1_id),
            member2: getName(p.panel_member_2_id),
          });

          // Auto-open the panel section if one already exists
          setPanelOpen(true);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load vacancy details.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [vacancyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Patch only the editable fields
      const patchRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/vacancies/${vacancyId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      if (!patchRes.ok) {
        const errData = await patchRes.json().catch(() => null);
        setError(errData?.detail ?? "Failed to save changes.");
        setSaving(false);
        return;
      }

      // Save the panel whenever a panel head has been selected
      if (panel.panel_head_id) {
        const panelRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/vacancies/${vacancyId}/panel`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              panel_head_id: Number(panel.panel_head_id),
              panel_member_1_id: panel.panel_member_1_id ? Number(panel.panel_member_1_id) : null,
              panel_member_2_id: panel.panel_member_2_id ? Number(panel.panel_member_2_id) : null,
              interview_link: panel.interview_link || null,
            }),
          }
        );
        if (!panelRes.ok) {
          const panelErr = await panelRes.json().catch(() => null);
          setError(panelErr?.detail ?? "Panel saved failed.");
          setSaving(false);
          return;
        }
      }

      router.push("/recruitment");
    } catch (err) {
      console.error(err);
      setError("Could not connect to the server.");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center text-gray-400 text-sm">
        Loading vacancy...
      </div>
    );
  }

  if (!vacancy) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center text-gray-400 text-sm">
        Vacancy not found.{" "}
        <Link href="/recruitment" className="text-orange-500 ml-1">
          Go back
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar activePath="/recruitment" />

      <div className="flex-1 flex flex-col">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-8">
          {/* Back */}
          <Link
            href="/recruitment"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
          >
            ← Back to Vacancies
          </Link>

          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Edit Vacancy
          </h2>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">

            {/* Error */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {/* Read-only locked fields */}
            <div className="mb-8 pb-8 border-b border-gray-100 space-y-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Locked — cannot be changed after creation
              </p>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Position Title</p>
                  <p className="text-sm font-medium text-gray-700 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                    {vacancy.title}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Department</p>
                  <p className="text-sm font-medium text-gray-700 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                    {vacancy.department}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Experience Level</p>
                  <p className="text-sm font-medium text-gray-700 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                    {vacancy.experience_level ?? "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Editable form */}
            <form onSubmit={handleSubmit} className="space-y-6">

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

              {/* Job Description */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Job Description
                </label>
                <RichTextEditor
                  content={form.description}
                  onChange={(html) => setForm({ ...form, description: html })}
                  placeholder="Describe the role, responsibilities, and day-to-day tasks…"
                />
              </div>

              {/* Requirements */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Requirements
                </label>
                <RichTextEditor
                  content={form.requirements}
                  onChange={(html) => setForm({ ...form, requirements: html })}
                  placeholder="List qualifications, degrees, certifications, years of experience…"
                />
              </div>

              {/* Interview Panel */}
              <div className="border border-gray-200 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPanelOpen(!panelOpen)}
                  className="w-full flex justify-between items-center px-4 py-3 text-sm font-medium text-gray-700"
                >
                  Interview Panel
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
                      initialName={panelNames.head}
                    />

                    <EmployeeSearch
                      users={users}
                      onSelect={(id) =>
                        setPanel({ ...panel, panel_member_1_id: id })
                      }
                      placeholder="Search panel member"
                      initialName={panelNames.member1}
                    />

                    <EmployeeSearch
                      users={users}
                      onSelect={(id) =>
                        setPanel({ ...panel, panel_member_2_id: id })
                      }
                      placeholder="Search panel member"
                      initialName={panelNames.member2}
                    />

                    <input
                      type="text"
                      placeholder="Interview Link (Google Meet / Zoom)"
                      className={inputCls}
                      value={panel.interview_link}
                      onChange={(e) =>
                        setPanel({ ...panel, interview_link: e.target.value })
                      }
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => router.push("/recruitment")}
                  className="px-8 py-3 border border-orange-400 text-orange-500 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-3 bg-orange-400 hover:bg-orange-500 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>

            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
