"use client";
import { apiFetch } from "@/lib/api";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { IconChevron } from "../../../components/Icons";
import RichTextEditor from "../../../components/RichTextEditor";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

const baseInput =
  "w-full border rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 bg-white focus:outline-none transition";
const inputCls = `${baseInput} border-gray-200 focus:ring-2 focus:ring-orange-200 focus:border-orange-300`;
const errorCls = `${baseInput} border-red-300 ring-2 ring-red-100 focus:ring-red-200 focus:border-red-400`;
const fieldCls = (err?: string) => (err ? errorCls : inputCls);

type EligibleUser = { id: number; first_name: string; last_name: string; full_name: string; email: string };

type FormState = {
  title: string; department: string; experience_level: string;
  description: string; requirements: string; status: string;
};
type FormErrors = Partial<Record<keyof FormState, string>>;

function validate(form: FormState): FormErrors {
  const e: FormErrors = {};
  if (!form.title.trim()) e.title = "Position title is required.";
  else if (form.title.trim().length < 3) e.title = "Title must be at least 3 characters.";
  else if (form.title.trim().length > 100) e.title = "Title cannot exceed 100 characters.";
  if (!form.department.trim()) e.department = "Department is required.";
  else if (form.department.trim().length < 2) e.department = "Department must be at least 2 characters.";
  if (!form.experience_level) e.experience_level = "Please select an experience level.";
  const descText = stripHtml(form.description);
  if (!descText) e.description = "Job description is required.";
  else if (descText.length < 20) e.description = `At least 20 characters required (${descText.length} entered).`;
  const reqText = stripHtml(form.requirements);
  if (!reqText) e.requirements = "Requirements are required.";
  else if (reqText.length < 20) e.requirements = `At least 20 characters required (${reqText.length} entered).`;
  return e;
}

function UserSearch({ users, selectedId, onSelect, placeholder, excludeIds = [] }: {
  users: EligibleUser[]; selectedId: string; onSelect: (id: string) => void;
  placeholder: string; excludeIds?: number[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input type="text" placeholder={placeholder} className={inputCls} value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); onSelect(""); }}
        onFocus={() => setOpen(true)} />
      {open && (
        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl mt-2 shadow-lg max-h-52 overflow-y-auto">
          {filtered.length > 0 ? filtered.map((u) => (
            <div key={u.id}
              onClick={() => { onSelect(String(u.id)); setQuery(u.full_name); setOpen(false); }}
              className="px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 cursor-pointer flex justify-between items-center">
              <span className="font-medium">{u.full_name}</span>
              <span className="text-gray-400 text-xs">{u.email}</span>
            </div>
          )) : (
            <div className="px-4 py-3 text-sm text-gray-400">
              {query.length > 0
                ? "No eligible users found. Assign the Interview Panel permission in Role Management."
                : "No users with Interview Panel permission found."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      {msg}
    </p>
  );
}

function CharCount({ current, max }: { current: number; max: number }) {
  const near = current > max * 0.85;
  const over = current > max;
  return (
    <span className={`text-xs ${over ? "text-red-500" : near ? "text-orange-400" : "text-gray-400"}`}>
      {current}/{max}
    </span>
  );
}

const INITIAL_FORM: FormState = { title: "", department: "", experience_level: "", description: "", requirements: "", status: "Draft" };

export default function VacancyCreatePage() {
  const router = useRouter();
  const [eligibleUsers, setEligibleUsers] = useState<EligibleUser[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Set<keyof FormState>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [panelHeadId, setPanelHeadId] = useState("");
  const [interviewLink, setInterviewLink] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [panelError, setPanelError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/recruitment/panel-eligible-users`)
      .then((r) => r.json())
      .then((d) => setEligibleUsers(Array.isArray(d) ? d : []))
      .catch(() => setEligibleUsers([]));
  }, []);

  useEffect(() => {
    if (touched.size === 0) return;
    const freshErrors = validate(form);
    const visible: FormErrors = {};
    touched.forEach((k) => { if (freshErrors[k]) visible[k] = freshErrors[k]; });
    setErrors(visible);
  }, [form, touched]);

  const handleBlur = (field: keyof FormState) => setTouched((prev) => new Set(prev).add(field));
  const addMember = () => setMemberIds((prev) => [...prev, ""]);
  const removeMember = (idx: number) => setMemberIds((prev) => prev.filter((_, i) => i !== idx));
  const setMember = (idx: number, id: string) => setMemberIds((prev) => prev.map((v, i) => (i === idx ? id : v)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setPanelError(null);
    const allFields = Object.keys(INITIAL_FORM) as (keyof FormState)[];
    setTouched(new Set(allFields));
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    try {
      const vacancyRes = await apiFetch(`/recruitment/vacancies`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      if (!vacancyRes.ok) {
        const err = await vacancyRes.json().catch(() => ({}));
        if (Array.isArray(err.detail)) {
          const fieldMsgs: FormErrors = {};
          err.detail.forEach((d: { loc: string[]; msg: string }) => {
            const field = d.loc[d.loc.length - 1] as keyof FormState;
            if (field in INITIAL_FORM) fieldMsgs[field] = d.msg;
          });
          if (Object.keys(fieldMsgs).length > 0) { setErrors(fieldMsgs); return; }
        }
        setApiError(err.detail || "Failed to create vacancy. Please try again.");
        return;
      }
      const vacancy = await vacancyRes.json();
      if (panelHeadId) {
        const validMembers = memberIds.filter(Boolean).map(Number);
        const panelRes = await apiFetch(`/recruitment/vacancies/${vacancy.id}/panel`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ panel_head_id: Number(panelHeadId), interview_link: interviewLink || null, member_ids: validMembers }),
        });
        if (!panelRes.ok) {
          const err = await panelRes.json().catch(() => ({}));
          setPanelError(err.detail || "Vacancy created but panel could not be saved.");
          router.push(`/recruitment/${vacancy.id}`);
          return;
        }
      }
      router.push("/recruitment");
    } catch {
      setApiError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const headUser = eligibleUsers.find((u) => String(u.id) === panelHeadId);
  const filledMembers = memberIds.filter(Boolean);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Vacancy</h2>
      {apiError && (
        <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3.5 text-sm text-red-700">
          <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{apiError}</span>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>

          <div data-field-error={errors.title ? true : undefined}>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-sm font-medium text-gray-700">Position Title <span className="text-red-400">*</span></label>
              <CharCount current={form.title.length} max={100} />
            </div>
            <input id="field-title" type="text" placeholder="e.g. Senior Software Engineer" className={fieldCls(errors.title)} value={form.title} onChange={set("title")} onBlur={() => handleBlur("title")} maxLength={110} />
            <FieldError msg={errors.title} />
          </div>

          <div data-field-error={errors.department ? true : undefined}>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-sm font-medium text-gray-700">Department <span className="text-red-400">*</span></label>
              <CharCount current={form.department.length} max={80} />
            </div>
            <input id="field-department" type="text" placeholder="e.g. IT, Finance, HR" className={fieldCls(errors.department)} value={form.department} onChange={set("department")} onBlur={() => handleBlur("department")} maxLength={90} />
            <FieldError msg={errors.department} />
          </div>

          <div data-field-error={errors.experience_level ? true : undefined}>
            <label className="block mb-2 text-sm font-medium text-gray-700">Experience Level <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-4 gap-3">
              {(["Intern", "Junior", "Mid", "Senior"] as const).map((level) => (
                <button type="button" key={level}
                  onClick={() => { setForm((prev) => ({ ...prev, experience_level: level })); setTouched((prev) => new Set(prev).add("experience_level")); }}
                  className={`py-3 rounded-xl border text-sm font-medium transition ${form.experience_level === level ? "bg-orange-400 text-white border-orange-400 shadow-sm" : errors.experience_level ? "bg-white text-red-400 border-red-300 hover:border-orange-300" : "bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-500"}`}
                >{level}</button>
              ))}
            </div>
            <FieldError msg={errors.experience_level} />
          </div>

          <div data-field-error={errors.description ? true : undefined}>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-sm font-medium text-gray-700">Job Description <span className="text-red-400">*</span></label>
              <CharCount current={stripHtml(form.description).length} max={5000} />
            </div>
            <RichTextEditor content={form.description} onChange={(html) => setForm((prev) => ({ ...prev, description: html }))} onBlur={() => handleBlur("description")} placeholder="Describe the role, responsibilities, and day-to-day tasks…" hasError={!!errors.description} />
            <FieldError msg={errors.description} />
          </div>

          <div data-field-error={errors.requirements ? true : undefined}>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-sm font-medium text-gray-700">Requirements <span className="text-sm font-medium text-red-400">*</span></label>
              <CharCount current={stripHtml(form.requirements).length} max={5000} />
            </div>
            <RichTextEditor content={form.requirements} onChange={(html) => setForm((prev) => ({ ...prev, requirements: html }))} onBlur={() => handleBlur("requirements")} placeholder="List qualifications, degrees, certifications, years of experience…" hasError={!!errors.requirements} />
            <FieldError msg={errors.requirements} />
          </div>

          <div>
            <label className="block mb-1.5 text-sm font-medium text-gray-700">Initial Status</label>
            <div className="relative w-full">
              <select value={form.status} onChange={set("status")} className="w-full appearance-none bg-white border border-gray-200 rounded-xl pl-4 pr-9 py-3 text-sm text-gray-700 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition">
                <option value="Draft">Draft — not visible to candidates</option>
                <option value="Active">Active — accepting applications</option>
                <option value="Closed">Closed — no longer accepting</option>
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><IconChevron /></span>
            </div>
          </div>

          {/* ── Interview Panel ─────────────────────────────────────────────── */}
          <div className="border border-gray-200 rounded-xl">
            <button type="button" onClick={() => setPanelOpen(!panelOpen)}
              className="w-full flex justify-between items-center px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition rounded-xl">
              <span className="flex items-center gap-2">
                Interview Panel
                <span className="text-gray-400 font-normal">(optional)</span>
                {headUser && (
                  <span className="bg-orange-100 text-orange-600 text-xs font-medium px-2 py-0.5 rounded-full">
                    {headUser.full_name}{filledMembers.length > 0 ? ` + ${filledMembers.length} member${filledMembers.length > 1 ? "s" : ""}` : ""}
                  </span>
                )}
              </span>
              <span className="text-lg text-gray-400">{panelOpen ? "−" : "+"}</span>
            </button>

            {panelOpen && (
              <div className="p-6 border-t border-gray-200 space-y-5 bg-gray-50/50">
                {panelError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                    ⚠ {panelError}
                  </div>
                )}

                {/* Panel Head */}
                <div>
                  <label className="block mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Panel Head <span className="text-red-400">*</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    Only users with the "Interview Panel" permission are shown. Assign this via Role Management.
                  </p>
                  <UserSearch users={eligibleUsers} selectedId={panelHeadId} onSelect={setPanelHeadId}
                    placeholder="Search panel head by name…"
                    excludeIds={memberIds.filter(Boolean).map(Number)} />
                </div>

                {/* Calendly / Interview Link */}
                <div>
                  <label className="block mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Interview Link
                  </label>
                  <input type="url" placeholder="Your Cita link" className={inputCls}
                    value={interviewLink} onChange={(e) => setInterviewLink(e.target.value)} />
                </div>

                {/* Dynamic Panel Members */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Panel Members</p>
                      <p className="text-xs text-gray-400 mt-0.5">Additional evaluators — must also have the Interview Panel permission.</p>
                    </div>
                    <button type="button" onClick={addMember}
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
                              onSelect={(id) => setMember(idx, id)}
                              placeholder={`Search member ${idx + 1}…`}
                              excludeIds={[
                                panelHeadId ? Number(panelHeadId) : 0,
                                ...memberIds.filter((_, i) => i !== idx).filter(Boolean).map(Number),
                              ].filter(Boolean)} />
                          </div>
                          <button type="button" onClick={() => removeMember(idx)}
                            className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition shrink-0" title="Remove">
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

          <p className="text-xs text-gray-400">Fields marked <span className="text-red-400">*</span> are required.</p>

          <div className="flex gap-4 pt-2">
            <button type="button" onClick={() => router.push("/recruitment")} className="px-8 py-3 border border-orange-400 text-orange-500 rounded-xl hover:bg-orange-50 transition text-sm font-medium">Cancel</button>
            <button type="submit" disabled={submitting} className="px-8 py-3 bg-orange-400 hover:bg-orange-500 disabled:bg-orange-300 disabled:cursor-not-allowed text-white rounded-xl transition text-sm font-medium flex items-center gap-2">
              {submitting ? (<><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Creating…</>) : "Create Vacancy"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
