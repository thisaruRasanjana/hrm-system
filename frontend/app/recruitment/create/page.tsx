"use client";
import { API_BASE_URL } from "@/lib/constants";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { IconChevron } from "../../../components/Icons";
import RichTextEditor from "../../../components/RichTextEditor";

// Strip HTML tags to get plain text (for validation + char count)
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

// ── Shared style helpers ───────────────────────────────────────────────────────

const baseInput =
  "w-full border rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 bg-white focus:outline-none transition";

const inputCls = `${baseInput} border-gray-200 focus:ring-2 focus:ring-orange-200 focus:border-orange-300`;
const errorCls = `${baseInput} border-red-300 ring-2 ring-red-100 focus:ring-red-200 focus:border-red-400`;

const fieldCls = (err?: string) => (err ? errorCls : inputCls);

// ── Types ──────────────────────────────────────────────────────────────────────

type User = { id: number; first_name: string; last_name: string };

type FormState = {
  title: string;
  department: string;
  experience_level: string;
  description: string;
  requirements: string;
  status: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

// ── Validation rules (mirrors backend Pydantic constraints) ───────────────────

function validate(form: FormState): FormErrors {
  const e: FormErrors = {};

  if (!form.title.trim())
    e.title = "Position title is required.";
  else if (form.title.trim().length < 3)
    e.title = "Title must be at least 3 characters.";
  else if (form.title.trim().length > 100)
    e.title = "Title cannot exceed 100 characters.";

  if (!form.department.trim())
    e.department = "Department is required.";
  else if (form.department.trim().length < 2)
    e.department = "Department must be at least 2 characters.";

  if (!form.experience_level)
    e.experience_level = "Please select an experience level.";

  const descText = stripHtml(form.description);
  if (!descText)
    e.description = "Job description is required.";
  else if (descText.length < 20)
    e.description = `At least 20 characters required (${descText.length} entered).`;

  const reqText = stripHtml(form.requirements);
  if (!reqText)
    e.requirements = "Requirements are required.";
  else if (reqText.length < 20)
    e.requirements = `At least 20 characters required (${reqText.length} entered).`;

  return e;
}

// ── Employee search dropdown ───────────────────────────────────────────────────

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
  const ref = useRef<HTMLDivElement>(null);

  const filtered = users.filter((u) =>
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
      <input
        type="text"
        placeholder={placeholder}
        className={inputCls}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
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

// ── Error message component ───────────────────────────────────────────────────

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

// ── Character counter ─────────────────────────────────────────────────────────

function CharCount({ current, max }: { current: number; max: number }) {
  const near = current > max * 0.85;
  const over = current > max;
  return (
    <span className={`text-xs ${over ? "text-red-500" : near ? "text-orange-400" : "text-gray-400"}`}>
      {current}/{max}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const INITIAL_FORM: FormState = {
  title: "",
  department: "",
  experience_level: "",
  description: "",
  requirements: "",
  status: "Draft",
};

export default function VacancyCreatePage() {
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Set<keyof FormState>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [panel, setPanel] = useState({
    panel_head_id: "",
    panel_member_1_id: "",
    panel_member_2_id: "",
    interview_link: "",
  });

  useEffect(() => {
    fetch(`${API_BASE_URL}/employees/`)
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
  }, []);

  // Re-validate touched fields live as the user types
  useEffect(() => {
    if (touched.size === 0) return;
    const freshErrors = validate(form);
    const visible: FormErrors = {};
    touched.forEach((k) => { if (freshErrors[k]) visible[k] = freshErrors[k]; });
    setErrors(visible);
  }, [form, touched]);

  const handleBlur = (field: keyof FormState) => {
    setTouched((prev) => new Set(prev).add(field));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    // Mark all fields as touched so every error shows
    const allFields = Object.keys(INITIAL_FORM) as (keyof FormState)[];
    setTouched(new Set(allFields));

    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Scroll to first error
      const firstErrorEl = document.querySelector("[data-field-error]");
      firstErrorEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    try {
      const vacancyRes = await fetch(
        `${API_BASE_URL}/recruitment/vacancies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      if (!vacancyRes.ok) {
        const err = await vacancyRes.json().catch(() => ({}));
        // FastAPI 422 returns { detail: [{ loc, msg, type }] }
        if (Array.isArray(err.detail)) {
          const fieldMsgs: FormErrors = {};
          err.detail.forEach((d: { loc: string[]; msg: string }) => {
            const field = d.loc[d.loc.length - 1] as keyof FormState;
            if (field in INITIAL_FORM) fieldMsgs[field] = d.msg;
          });
          if (Object.keys(fieldMsgs).length > 0) {
            setErrors(fieldMsgs);
            return;
          }
        }
        setApiError(err.detail || "Failed to create vacancy. Please try again.");
        return;
      }

      const vacancy = await vacancyRes.json();

      if (panel.panel_head_id) {
        const panelRes = await fetch(
          `${API_BASE_URL}/recruitment/vacancies/${vacancy.id}/panel`,
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
          const err = await panelRes.json().catch(() => ({}));
          setApiError(err.detail || "Vacancy created but panel could not be saved.");
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

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

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
              <label className="text-sm font-medium text-gray-700">Requirements <span className="text-red-400">*</span></label>
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

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button type="button" onClick={() => setPanelOpen(!panelOpen)} className="w-full flex justify-between items-center px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              <span>Interview Panel <span className="text-gray-400 font-normal">(optional)</span></span>
              <span className="text-lg text-gray-400">{panelOpen ? "−" : "+"}</span>
            </button>
            {panelOpen && (
              <div className="p-6 border-t border-gray-200 space-y-4 bg-gray-50/50">
                <div><label className="block mb-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Panel Head</label><EmployeeSearch users={users} onSelect={(id) => setPanel({ ...panel, panel_head_id: id })} placeholder="Search by name" /></div>
                <div><label className="block mb-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Panel Member 1</label><EmployeeSearch users={users} onSelect={(id) => setPanel({ ...panel, panel_member_1_id: id })} placeholder="Search by name" /></div>
                <div><label className="block mb-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Panel Member 2</label><EmployeeSearch users={users} onSelect={(id) => setPanel({ ...panel, panel_member_2_id: id })} placeholder="Search by name" /></div>
                <div>
                  <label className="block mb-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Interview Link</label>
                  <input type="url" placeholder="https://meet.google.com/..." className={inputCls} value={panel.interview_link} onChange={(e) => setPanel({ ...panel, interview_link: e.target.value })} />
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