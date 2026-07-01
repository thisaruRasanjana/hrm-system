"use client";
import { apiFetch } from "@/lib/api";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { IconChevron } from "@/components/Icons";
import { API_BASE_URL, VACANCY_STATUS, CANDIDATE_STATUS } from "@/lib/constants";
import ConfirmModal from "@/app/components/ConfirmModal";

type Vacancy = {
  id: number;
  title: string;
  status: string;
};

type Candidate = {
  id: number;
  full_name: string;
  phone: string;
  status: string;
  ai_score?: number | null;
};

type EvaluatedCandidate = {
  application_id: number;
  candidate_id: number;
  full_name: string;
  phone: string;
  eval_count: number;
  avg_score: number;
  decision: string | null;
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
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-200 rounded-lg pl-4 pr-9 py-2.5 text-sm text-gray-700 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition shadow-sm"
      >
        {children}
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <IconChevron />
      </span>
    </div>
  );
}

function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision) {
    return (
      <span className="bg-gray-100 text-gray-400 px-3 py-1 rounded-full text-xs font-medium">
        Pending
      </span>
    );
  }
  const colors: Record<string, string> = {
    Selected: "bg-green-100 text-green-700",
    Rejected: "bg-red-100 text-red-600",
    "Keep for Future": "bg-blue-100 text-blue-600",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors[decision] ?? "bg-gray-100 text-gray-500"}`}>
      {decision}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    [CANDIDATE_STATUS.UPLOADED]: "bg-gray-100 text-gray-500",
    [CANDIDATE_STATUS.CALLED]: "bg-blue-100 text-blue-600",
    [CANDIDATE_STATUS.SECOND_ROUND_PENDING]: "bg-yellow-100 text-yellow-600",
    [CANDIDATE_STATUS.FIRST_ROUND]: "bg-orange-100 text-orange-600",
    [CANDIDATE_STATUS.SECOND_ROUND]: "bg-purple-100 text-purple-600",
    [CANDIDATE_STATUS.JOB_OFFERED]: "bg-green-100 text-green-700",
    [CANDIDATE_STATUS.REJECTED]: "bg-red-100 text-red-600",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  );
}

export default function VacancyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vacancyId = params.id as string;

  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);

  // Delete-vacancy confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const copyShareLink = () => {
    const url = `${window.location.origin}/jobs/${vacancyId}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const openDeleteConfirm = () => {
    setDeleteError("");
    setShowDeleteConfirm(true);
  };

  const confirmDeleteVacancy = async () => {
    setIsDeleting(true);
    setDeleteError("");
    try {
      const res = await apiFetch(`/recruitment/vacancies/${vacancyId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/recruitment");
        return; // navigating away — keep the spinner until unmount
      }
      setDeleteError("Failed to delete vacancy. Please try again.");
    } catch (err) {
      console.error(err);
      setDeleteError("Something went wrong while deleting. Please try again.");
    }
    setIsDeleting(false);
  };
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");

  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "evaluated" ? "evaluated" : "all";
  const [activeTab, setActiveTab] = useState<"all" | "evaluated">(initialTab);
  const [evaluatedCandidates, setEvaluatedCandidates] = useState<EvaluatedCandidate[]>([]);
  const [evaluatedLoading, setEvaluatedLoading] = useState(false);

  // "See More" state — show top 5 by default, expand on demand (spec §1.3.2 / §1.3.3)
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const TOP_N = 5;

  // Re-run AI Screening state
  const [rerunning, setRerunning] = useState(false);

  useEffect(() => {
    if (!vacancyId) return;

    apiFetch(`/recruitment/vacancies/${vacancyId}`)
      .then((res) => res.json())
      .then((data) => setVacancy(data))
      .catch(console.error);

    apiFetch(`/recruitment/vacancies/${vacancyId}/candidates`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCandidates(data);
        else setCandidates([]);
      })
      .catch(console.error);
  }, [vacancyId]);

  useEffect(() => {
    if (activeTab !== "evaluated") return;
    setEvaluatedLoading(true);
    apiFetch(`/recruitment/vacancies/${vacancyId}/evaluated-candidates`)
      .then((r) => r.json())
      .then((d) => {
        setEvaluatedCandidates(Array.isArray(d) ? d : []);
        setEvaluatedLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setEvaluatedLoading(false);
      });
  }, [activeTab, vacancyId]);

  const sorted = candidates
    .filter((c) => {
      const matchesSearch =
        search === "" || c.full_name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "All Status" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0));

  const displayed = showAllCandidates ? sorted : sorted.slice(0, TOP_N);

  const rerunAI = async () => {
    setRerunning(true);
    try {
      await apiFetch(`/recruitment/vacancies/${vacancyId}/run-ai-screening`,
        { method: "POST" }
      );
      // Refresh candidate list to show updated scores
      const data = await apiFetch(`/recruitment/vacancies/${vacancyId}/candidates`
      ).then((r) => r.json());
      if (Array.isArray(data)) setCandidates(data);
    } catch (err) {
      console.error("Re-run AI failed:", err);
    }
    setRerunning(false);
  };

  return (
    <>
          {/* Back */}
          <Link
            href="/recruitment"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
          >
            ← Back to Vacancies
          </Link>

          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Candidates – {vacancy?.title ?? ""}
            </h2>

            <div className="flex items-center gap-3">
              <button
                onClick={openDeleteConfirm}
                className="border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                title="Delete Vacancy"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
              {vacancy?.status === VACANCY_STATUS.ACTIVE && (
                <button
                  onClick={copyShareLink}
                  className={`flex items-center gap-2 border px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${linkCopied
                      ? "border-green-400 text-green-600 bg-green-50"
                      : "border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-500 hover:bg-orange-50"
                    }`}
                >
                  {linkCopied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Link Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Share Job Posting
                    </>
                  )}
                </button>
              )}
              {vacancy?.status === VACANCY_STATUS.ACTIVE && (
                <button
                  onClick={rerunAI}
                  disabled={rerunning}
                  className="border border-orange-400 text-orange-500 hover:bg-orange-50 disabled:opacity-60 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  {rerunning ? "Re-scoring..." : "↺ Re-run AI Screening"}
                </button>
              )}
              {vacancy?.status === VACANCY_STATUS.ACTIVE && (
                <Link
                  href={`/recruitment/${vacancyId}/upload`}
                  className="bg-orange-400 hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  + Add CV
                </Link>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
            {(["all", "evaluated"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                {tab === "all" ? "All Candidates" : "Evaluated"}
              </button>
            ))}
          </div>

          {/* ── All Candidates tab ──────────────────────────────────────── */}
          {activeTab === "all" && (
            <>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Search Candidate..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition shadow-sm w-72"
                />
                <FilterSelect value={statusFilter} onChange={setStatusFilter}>
                  <option>All Status</option>
                  <option>Uploaded</option>
                  <option>Called</option>
                  <option>First Round</option>
                  <option>Second Round</option>
                  <option>Job Offered</option>
                  <option>Rejected</option>
                </FilterSelect>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Name</th>
                      <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Phone</th>
                      <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">AI Score</th>
                      <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Status</th>
                      <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                          No candidates found.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {displayed.map((c) => (
                          <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-gray-800 text-sm">{c.full_name}</td>
                            <td className="px-6 py-4 text-gray-600 text-sm text-center">{c.phone}</td>
                            <td className="px-6 py-4 text-gray-600 text-sm text-center">{c.ai_score != null ? `${c.ai_score}%` : <span className="text-blue-500 animate-pulse text-xs">Processing...</span>}</td>
                            <td className="px-6 py-4 text-center">
                              <StatusBadge status={c.status} />
                            </td>
                            <td className="px-6 py-4 text-sm text-center">
                              <Link
                                href={`/recruitment/${vacancyId}/candidates/${c.id}`}
                                className="text-orange-500 hover:text-orange-600 font-medium transition-colors"
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                        {sorted.length > TOP_N && (
                          <tr className="border-t border-gray-100">
                            <td colSpan={5} className="text-center py-4">
                              <button
                                onClick={() => setShowAllCandidates(!showAllCandidates)}
                                className="text-orange-500 hover:text-orange-600 text-sm font-medium transition-colors"
                              >
                                {showAllCandidates
                                  ? `▲ Show Top ${TOP_N} Only`
                                  : `▼ See All ${sorted.length} Candidates`}
                              </button>
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Evaluated tab ──────────────────────────────────────────── */}
          {activeTab === "evaluated" && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Candidate</th>
                    <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Evaluations</th>
                    <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Avg Score</th>
                    <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Decision</th>
                    <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluatedLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">Loading...</td>
                    </tr>
                  ) : evaluatedCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                        No evaluated candidates yet.
                      </td>
                    </tr>
                  ) : (
                    evaluatedCandidates.map((c) => (
                      <tr key={c.candidate_id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-gray-800 text-sm font-medium">{c.full_name}</td>
                        <td className="px-6 py-4 text-gray-500 text-sm text-center">
                          {c.eval_count} evaluation{c.eval_count !== 1 ? "s" : ""}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-orange-500 font-bold text-sm">{c.avg_score.toFixed(1)}%</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <DecisionBadge decision={c.decision} />
                        </td>
                        <td className="px-6 py-4 text-sm text-center">
                          <div className="flex items-center justify-center gap-4">
                            <Link
                              href={`/recruitment/${vacancyId}/candidates/${c.candidate_id}/final-decision?from=evaluated`}
                              className="text-orange-500 hover:text-orange-600 font-medium transition-colors"
                            >
                              View &amp; Decide
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Vacancy"
        message={
          deleteError ||
          "Are you sure you want to permanently delete this vacancy? This will also delete all applications and evaluations tied to it."
        }
        confirmText="Delete Vacancy"
        cancelText="Cancel"
        type="danger"
        loading={isDeleting}
        onConfirm={confirmDeleteVacancy}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteError("");
        }}
      />
    </>
  );
}