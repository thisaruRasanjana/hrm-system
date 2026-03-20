"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";
import { IconChevron } from "@/components/Icons";

type Vacancy = {
  id: number;
  title: string;
  status: string;
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

  // Only Active vacancies are shown
  const [activeVacancies, setActiveVacancies] = useState<Vacancy[]>([]);
  const [selectedVacancy, setSelectedVacancy] = useState<string>("");

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/vacancies`)
      .then((res) => res.json())
      .then((data: Vacancy[]) => {
        // Filter to Active vacancies only — closed vacancies cannot accept uploads
        const active = Array.isArray(data)
          ? data.filter((v) => v.status?.toLowerCase() === "active")
          : [];
        setActiveVacancies(active);

        // Pre-select from URL param only if the vacancy is Active
        if (vacancyIdFromUrl) {
          const match = active.find((v) => String(v.id) === vacancyIdFromUrl);
          if (match) {
            setSelectedVacancy(vacancyIdFromUrl);
          }
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
    files.forEach((file) => {
      formData.append("files", file);
    });

    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/vacancies/${selectedVacancy}/upload-cvs`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) {
        // Parse error message from backend
        const errData = await res.json().catch(() => null);
        const message =
          errData?.detail ?? "Upload failed. Please try again.";
        setError(message);
        setLoading(false);
        return;
      }

      router.push(`/recruitment/${selectedVacancy}`);
    } catch (err) {
      console.error(err);
      setError("Could not connect to the server. Make sure the backend is running.");
    }

    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar activePath="/recruitment" />

      <div className="flex-1 flex flex-col">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-8 flex justify-center">
          <div className="w-full max-w-3xl bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">

            {/* Back Button */}
            <Link
              href={`/recruitment/${selectedVacancy || ""}`}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
            >
              ← Back to Candidates
            </Link>

            <h1 className="text-2xl font-bold text-gray-800 mb-8">
              CV Upload
            </h1>

            {/* Error Banner */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {/* Vacancy Select — Active only */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Select Position *
              </label>

              {activeVacancies.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                  No active vacancies available.
                </p>
              ) : (
                <FilterSelect
                  value={selectedVacancy}
                  onChange={(v) => { setSelectedVacancy(v); setError(null); }}
                >
                  <option value="">Select vacancy</option>
                  {activeVacancies.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
                </FilterSelect>
              )}
            </div>

            {/* Drag Area */}
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
                Multiple files allowed
              </p>

              <input
                id="fileInput"
                type="file"
                multiple
                hidden
                onChange={handleFileChange}
              />
            </div>

            {/* Selected files with individual remove */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  {files.length} file(s) selected
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

            {/* Buttons */}
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