"use client";
import { API_BASE_URL } from "@/lib/constants";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";
import { IconChevron } from "@/components/Icons";

const API = API_BASE_URL;

type Vacancy = {
  id: number;
  title: string;
  department: string;
  experience_level: string | null;
  status: string;
};

type UploadResult = {
  successful_uploads: number;
  failed_uploads: number;
  message: string;
};

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative inline-flex items-center w-full">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-full bg-white border border-gray-200 rounded-lg pl-4 pr-9 py-2.5 text-sm text-gray-700 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition shadow-sm"
      >
        {children}
      </select>

      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <IconChevron />
      </span>
    </div>
  );
}

export default function UploadCVPage() {
  const router = useRouter();
  const params = useParams();
  const vacancyIdFromUrl = params.id as string;

  // Only Active vacancies can accept uploads (spec §1.2.1)
  const [activeVacancies, setActiveVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload summary shown after upload completes (spec §1.2.4)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  useEffect(() => {
    fetch(`${API}/recruitment/vacancies`)
      .then((res) => res.json())
      .then((data: Vacancy[]) => {
        const active = Array.isArray(data)
          ? data.filter((v) => v.status?.toLowerCase() === "active")
          : [];
        setActiveVacancies(active);

        // Pre-select from URL param only if that vacancy is Active
        if (vacancyIdFromUrl) {
          const match = active.find((v) => String(v.id) === vacancyIdFromUrl);
          if (match) setSelectedVacancy(vacancyIdFromUrl);
        }
      })
      .catch(console.error);
  }, [vacancyIdFromUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setFiles(Array.from(e.target.files));
    setError(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setFiles(Array.from(e.dataTransfer.files));
    setError(null);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    setError(null);

    if (!selectedVacancy) {
      setError("Please select a position before uploading.");
      return;
    }
    if (files.length === 0) {
      setError("Please select at least one CV file.");
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    setLoading(true);

    try {
      const res = await fetch(
        `${API}/recruitment/vacancies/${selectedVacancy}/upload-cvs`,
        { method: "POST", body: formData }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        setError(errData?.detail ?? "Upload failed. Please try again.");
        setLoading(false);
        return;
      }

      // Show summary instead of immediately redirecting (spec §1.2.4)
      const result: UploadResult = await res.json();
      setUploadResult(result);
    } catch (err) {
      console.error(err);
      setError("Could not connect to the server. Make sure the backend is running.");
    }

    setLoading(false);
  };

  // ── Upload Summary Screen ──────────────────────────────────────────────────
  if (uploadResult) {
    return (
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar activePath="/recruitment" />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-8 flex justify-center">
            <div className="w-full max-w-3xl bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
              <div className="flex flex-col items-center text-center py-8">
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-6">
                  <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>

                <h2 className="text-2xl font-bold text-gray-800 mb-2">Upload Complete</h2>
                <p className="text-sm text-gray-500 mb-8">
                  AI screening is running in the background — scores will appear shortly.
                </p>

                <div className="flex gap-6 mb-8 w-full max-w-xs">
                  <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">
                      {uploadResult.successful_uploads}
                    </p>
                    <p className="text-xs text-green-700 mt-1 font-medium">Uploaded</p>
                  </div>
                  {uploadResult.failed_uploads > 0 && (
                    <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                      <p className="text-3xl font-bold text-red-500">
                        {uploadResult.failed_uploads}
                      </p>
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        Failed
                      </p>
                    </div>
                  )}
                </div>

                {uploadResult.failed_uploads > 0 && (
                  <p className="text-xs text-gray-400 mb-6">
                    Failed files may be unsupported formats, corrupted, or duplicate uploads.
                  </p>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={() => { setUploadResult(null); setFiles([]); }}
                    className="px-6 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-100 text-sm font-medium"
                  >
                    Upload More
                  </button>
                  <button
                    onClick={() => router.push(`/recruitment/${selectedVacancy}`)}
                    className="px-6 py-2.5 bg-orange-400 hover:bg-orange-500 text-white rounded-xl text-sm font-medium transition"
                  >
                    View Candidates →
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ── Upload Form ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar activePath="/recruitment" />

      <div className="flex-1 flex flex-col">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-8 flex justify-center">
          <div className="w-full max-w-3xl bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">

            <Link
              href={`/recruitment/${selectedVacancy || ""}`}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
            >
              ← Back to Candidates
            </Link>

            <h1 className="text-2xl font-bold text-gray-800 mb-8">CV Upload</h1>

            {/* Error Banner */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {/* Vacancy Select — Active only; shows context (spec §1.2.1) */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Select Position *
              </label>

              {activeVacancies.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                  No active vacancies available. A vacancy must be set to &quot;Active&quot; before CVs can be uploaded.
                </p>
              ) : (
                <FilterSelect
                  value={selectedVacancy}
                  onChange={(v) => { setSelectedVacancy(v); setError(null); }}
                >
                  <option value="">Select vacancy...</option>
                  {activeVacancies.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title} — {v.department}
                      {v.experience_level ? ` (${v.experience_level})` : ""}
                    </option>
                  ))}
                </FilterSelect>
              )}
            </div>

            {/* Drag-and-drop zone (spec §1.2.2) */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => document.getElementById("fileInput")?.click()}
              className="border-2 border-dashed border-gray-300 rounded-2xl h-56 flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:border-orange-400 transition"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-10 h-10 text-orange-400 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                />
              </svg>

              <p className="text-sm font-medium">
                Drag and drop CVs here or click to browse
              </p>
              <p className="text-xs text-gray-400 mt-1">
                PDF and DOCX only — Multiple files allowed
              </p>

              <input
                id="fileInput"
                type="file"
                multiple
                hidden
                accept=".pdf,.docx"
                onChange={handleFileChange}
              />
            </div>

            {/* Selected files with individual remove (spec §1.2.3) */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  {files.length} file{files.length !== 1 ? "s" : ""} selected
                </p>

                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-700"
                  >
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(i);
                      }}
                      className="ml-3 text-gray-400 hover:text-red-500 transition text-xs shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4 mt-8">
              <button
                onClick={() => router.back()}
                className="px-6 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>

              <button
                onClick={handleUpload}
                disabled={loading}
                className="bg-orange-400 hover:bg-orange-500 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl font-medium transition"
              >
                {loading ? "Uploading..." : "Upload CVs"}
              </button>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}