"use client";
import { API_BASE_URL } from "@/lib/constants";

// Page-level SEO title is set dynamically in the component via document.title
// since this is a client component. For SSR metadata, migrate to a server component.

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type Vacancy = {
  id: number;
  title: string;
  department: string;
  experience_level: string | null;
  description: string | null;
  requirements: string | null;
  created_date: string;
};

type PageState = "loading" | "active" | "unavailable" | "success" | "error";

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(dateStr: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 86_400_000
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff} days ago`;
}

function formatText(text: string) {
  return text.split("\n").map((line, i) =>
    line.trim() ? (
      <p key={i} className="mb-2 leading-relaxed">
        {line}
      </p>
    ) : (
      <br key={i} />
    )
  );
}

// ── Drag-and-drop upload zone ─────────────────────────────────────────────────

function UploadZone({
  file,
  onFile,
  error,
}: {
  file: File | null;
  onFile: (f: File) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") return;
    if (f.size > 5 * 1024 * 1024) return;
    onFile(f);
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) accept(f);
      }}
      className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all p-8 text-center
        ${dragging ? "border-orange-400 bg-orange-50 scale-[1.01]" : ""}
        ${file ? "border-green-400 bg-green-50" : !dragging ? "border-gray-200 bg-gray-50 hover:border-orange-300 hover:bg-orange-50/50" : ""}
        ${error ? "border-red-300 bg-red-50" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) accept(f); }}
      />

      {file ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-green-700">{file.name}</p>
          <p className="text-xs text-green-500">
            {(file.size / 1024).toFixed(0)} KB — click to change
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">
              Drag & drop your CV here
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              or <span className="text-orange-500 underline underline-offset-2">browse files</span>
            </p>
          </div>
          <p className="text-xs text-gray-400">PDF or DOCX · max 5 MB</p>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PublicJobPage() {
  const { id } = useParams<{ id: string }>();
  const API = API_BASE_URL;

  const [pageState, setPageState] = useState<PageState>("loading");
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [email, setEmail] = useState("");
  const [fileError, setFileError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API}/public/jobs/${id}`)
      .then((r) => {
        if (r.status === 404) { setPageState("unavailable"); return null; }
        if (!r.ok) { setPageState("error"); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setVacancy(data);
        setPageState("active");
      })
      .catch(() => setPageState("error"));
  }, [id, API]);

  const handleFileSelect = (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      setFileError("Only PDF and DOCX files are accepted.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setFileError("File size must be under 5 MB.");
      return;
    }
    setFileError("");
    setCvFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!cvFile) {
      setFileError("Please select your CV to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("cv_file", cvFile);
      if (email.trim()) form.append("applicant_email", email.trim());

      const res = await fetch(`${API}/public/jobs/${id}/apply`, {
        method: "POST",
        body: form,
      });

      if (res.status === 409) {
        setSubmitError("It looks like you've already applied for this position.");
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSubmitError(err.detail || "Something went wrong. Please try again.");
        return;
      }

      setPageState("success");
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading job details…</p>
        </div>
      </div>
    );
  }

  // ── Unavailable / Error ────────────────────────────────────────────────────
  if (pageState === "unavailable" || pageState === "error") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Position Not Available</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            This position is no longer accepting applications, or the link may be incorrect.
            Please check with the recruiter who shared this link.
          </p>
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (pageState === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-3">Application Received!</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-2">
            Thank you for applying for <span className="font-semibold text-gray-700">{vacancy?.title}</span>.
          </p>
          <p className="text-gray-400 text-sm">
            Our team will review your application and get back to you soon.
          </p>
        </div>
      </div>
    );
  }

  // ── Active Job Page ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-3xl mx-auto px-6 py-16">
          {/* Brand */}
          <div className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-orange-400 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-300 tracking-wide">Careers</span>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-5">
            <span className="bg-white/10 border border-white/20 text-white/80 text-xs font-medium px-3 py-1 rounded-full">
              {vacancy?.department}
            </span>
            {vacancy?.experience_level && (
              <span className="bg-orange-400/20 border border-orange-400/30 text-orange-300 text-xs font-medium px-3 py-1 rounded-full">
                {vacancy.experience_level}
              </span>
            )}
            <span className="bg-white/10 border border-white/20 text-white/60 text-xs font-medium px-3 py-1 rounded-full">
              Posted {vacancy ? daysAgo(vacancy.created_date) : ""}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            {vacancy?.title}
          </h1>
          <p className="text-slate-400 text-sm">
            We're looking for the right person to join our team.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">

        {/* Job Description */}
        {vacancy?.description && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-orange-100 rounded-md flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
              </span>
              About This Role
            </h2>
            <div
              className="rich-content text-sm text-gray-600"
              dangerouslySetInnerHTML={{ __html: vacancy.description }}
            />
          </section>
        )}

        {/* Requirements */}
        {vacancy?.requirements && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-orange-100 rounded-md flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
              Requirements
            </h2>
            <div
              className="rich-content text-sm text-gray-600"
              dangerouslySetInnerHTML={{ __html: vacancy.requirements }}
            />
          </section>
        )}

        {/* Apply Form */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Apply for This Position</h2>
          <p className="text-sm text-gray-400 mb-6">Upload your CV and we'll take it from there.</p>

          <form onSubmit={handleSubmit} className="space-y-5">

            <UploadZone file={cvFile} onFile={handleFileSelect} error={fileError} />
            {fileError && (
              <p className="text-xs text-red-500 flex items-center gap-1 -mt-2">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {fileError}
              </p>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition"
              />
              <p className="mt-1 text-xs text-gray-400">
                Provided as a backup contact. We'll extract your info from your CV automatically.
              </p>
            </div>

            {submitError && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-orange-400 hover:bg-orange-500 disabled:bg-orange-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition text-sm flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Submitting…
                </>
              ) : (
                "Submit Application"
              )}
            </button>
          </form>
        </section>

        <p className="text-center text-xs text-gray-400 pb-4">
          Your data is handled securely and will only be used for this application.
        </p>
      </div>
    </div>
  );
}
