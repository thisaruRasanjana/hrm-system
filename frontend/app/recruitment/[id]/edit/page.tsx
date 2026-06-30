"use client";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/lib/constants";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  panel_head_name: string | null;
  interview_link: string | null;
  members: { user_id: number; full_name: string }[];
};

type EligibleUser = {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
};

// Searchable autocomplete for panel-eligible users only
function UserSearch({ users, selectedId, onSelect, placeholder, excludeIds = [] }: {
  users: EligibleUser[]; selectedId: string; onSelect: (id: string) => void;
  placeholder: string; excludeIds?: number[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedId) { setQuery(""); return; }
    const u = users.find((u) => String(u.id) === selectedId);
    if (u) setQuery(u.full_name);
  }, [selectedId, users]);

  const filtered = users.filter(
    (u) => !excludeIds.includes(u.id) &&
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input type="text" placeholder={placeholder} className={inputCls} value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); onSelect(""); }}
        onFocus={() => setOpen(true)} />
      {open && (
        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl mt-2 max-h-52 overflow-y-auto shadow-lg">
          {filtered.length > 0 ? filtered.map((u) => (
            <div key={u.id}
              onClick={() => { onSelect(String(u.id)); setQuery(u.full_name); setOpen(false); }}
              className="px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 cursor-pointer flex justify-between items-center">
              <span className="font-medium">{u.full_name}</span>
              <span className="text-gray-400 text-xs">{u.email}</span>
            </div>
          )) : (
            <div className="px-4 py-3 text-sm text-gray-400">
              {query.length > 0 ? "No eligible users found. Assign Interview Panel permission via Role Management." : "No users with Interview Panel permission found."}
            </div>
          )}
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
  const [eligibleUsers, setEligibleUsers] = useState<EligibleUser[]>([]);
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

  // Panel state — pre-filled after load
  const [panelHeadId, setPanelHeadId] = useState("");
  const [interviewLink, setInterviewLink] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);

  useEffect(() => {
    if (!vacancyId) return;

    const loadData = async () => {
      try {
        // Fetch vacancy details
        const vRes = await apiFetch(`/recruitment/vacancies/${vacancyId}`
        );
        if (!vRes.ok) throw new Error("Vacancy not found");
        const v: Vacancy = await vRes.json();
        setVacancy(v);
        setForm({
          description: v.description ?? "",
          requirements: v.requirements ?? "",
          status: v.status ?? "Active",
        });

        // Fetch panel-eligible users for panel search
        const empRes = await apiFetch(`/recruitment/panel-eligible-users`);
        const empData = await empRes.json();
        setEligibleUsers(Array.isArray(empData) ? empData : []);

        // Fetch existing panel (may return 404 — that's fine)
        const panelRes = await apiFetch(`/recruitment/vacancies/${vacancyId}/panel`);
        if (panelRes.ok) {
          const p: Panel = await panelRes.json();
          setPanelHeadId(p.panel_head_id ? String(p.panel_head_id) : "");
          setInterviewLink(p.interview_link ?? "");
          setMemberIds(p.members.map((m) => String(m.user_id)));
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
      const patchRes = await apiFetch(`/recruitment/vacancies/${vacancyId}`,
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
      if (panelHeadId) {
        const validMembers = memberIds.filter(Boolean).map(Number);
        const panelRes = await apiFetch(`/recruitment/vacancies/${vacancyId}/panel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            panel_head_id: Number(panelHeadId),
            interview_link: interviewLink || null,
            member_ids: validMembers,
          }),
        });
        if (!panelRes.ok) {
          const panelErr = await panelRes.json().catch(() => null);
          setError(panelErr?.detail ?? "Panel save failed.");
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
    <>
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
                <button type="button" onClick={() => setPanelOpen(!panelOpen)}
                  className="w-full flex justify-between items-center px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition rounded-xl">

                  <span className="flex items-center gap-2">
                    Interview Panel
                    {panelHeadId && (
                      <span className="bg-orange-100 text-orange-600 text-xs font-medium px-2 py-0.5 rounded-full">
                        {eligibleUsers.find(u => String(u.id) === panelHeadId)?.full_name ?? "Head selected"}
                        {memberIds.filter(Boolean).length > 0 && ` + ${memberIds.filter(Boolean).length} member${memberIds.filter(Boolean).length > 1 ? "s" : ""}`}
                      </span>
                    )}
                  </span>
                  <span>{panelOpen ? "−" : "+"}</span>
                </button>

                {panelOpen && (
                  <div className="p-6 border-t border-gray-200 space-y-5 bg-gray-50/50">

                    {/* Panel Head */}
                    <div>
                      <label className="block mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Panel Head <span className="text-red-400">*</span>
                      </label>
                      <p className="text-xs text-gray-400 mb-2">
                        Only users with the "Interview Panel" permission are shown.
                      </p>
                      <UserSearch users={eligibleUsers} selectedId={panelHeadId}
                        onSelect={setPanelHeadId} placeholder="Search panel head by name…"
                        excludeIds={memberIds.filter(Boolean).map(Number)} />
                    </div>

                    {/* Calendly / Interview Link */}
                    <div>
                      <label className="block mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Calendly / Interview Link</label>
                      <input type="url" placeholder="https://calendly.com/your-link" className={inputCls}
                        value={interviewLink} onChange={(e) => setInterviewLink(e.target.value)} />
                    </div>

                    {/* Dynamic Panel Members */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Panel Members</p>
                          <p className="text-xs text-gray-400 mt-0.5">Additional evaluators — must also have the Interview Panel permission.</p>
                        </div>
                        <button type="button" onClick={() => setMemberIds(prev => [...prev, ""])}
                          className="flex items-center gap-1.5 text-xs font-medium text-orange-500 hover:text-orange-600 border border-orange-200 hover:border-orange-300 rounded-lg px-3 py-1.5 hover:bg-orange-50 transition">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Member
                        </button>
                      </div>
                      {memberIds.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No additional members added yet.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {memberIds.map((memberId, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 w-6 text-right shrink-0">{idx + 1}.</span>
                              <div className="flex-1">
                                <UserSearch users={eligibleUsers} selectedId={memberId}
                                  onSelect={(id) => setMemberIds(prev => prev.map((v, i) => i === idx ? id : v))}
                                  placeholder={`Search member ${idx + 1}…`}
                                  excludeIds={[
                                    panelHeadId ? Number(panelHeadId) : 0,
                                    ...memberIds.filter((_, i) => i !== idx).filter(Boolean).map(Number),
                                  ].filter(Boolean)} />
                              </div>
                              <button type="button"
                                onClick={() => setMemberIds(prev => prev.filter((_, i) => i !== idx))}
                                className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition shrink-0">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
    </>
  );
}
