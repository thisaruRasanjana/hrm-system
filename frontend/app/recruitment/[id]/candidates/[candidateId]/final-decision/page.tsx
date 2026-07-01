"use client";
import { apiFetch } from "@/lib/api";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────────
type Evaluation = {
  id: number;
  round_number: number;
  technical_skills: number;
  problem_solving: number;
  communication: number;
  cultural_fit: number;
  attitude: number;
  overall_score: number;
  comments: string | null;
  evaluator_name: string | null;
};

type CategoryAverages = {
  technical_skills: number;
  problem_solving: number;
  communication: number;
  cultural_fit: number;
  attitude: number;
};

type FinalDecisionData = {
  candidate: { id: number; full_name: string; phone: string; email: string };
  vacancy: { id: number; title: string };
  evaluations: Evaluation[];          // current round only
  previous_rounds: Record<string, Evaluation[]>; // keyed by round number string
  current_round: number;
  category_averages: CategoryAverages;
  panel_avg_score: number;
  evaluator_count: number;
  final_decision: { decision: string; notes: string | null } | null;
  application_id: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CRITERIA = [
  { key: "technical_skills" as const, label: "Technical Skills" },
  { key: "problem_solving" as const, label: "Problem Solving" },
  { key: "communication" as const, label: "Communication" },
  { key: "cultural_fit" as const, label: "Cultural Fit" },
  { key: "attitude" as const, label: "Attitude" },
];

const DECISIONS = [
  { id: "Proceed to Next Round", label: "Proceed to Next Round", sub: "Schedule another interview round", icon: "→" },
  { id: "Job Offered",           label: "Job Offered",           sub: "Extend an offer to this candidate", icon: "✓" },
  { id: "Rejected",              label: "Rejected",              sub: "Does not meet requirements",      icon: "✕" },
];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

/** Segmented progress bar — filled segments for score out of 5 */
function SegmentBar({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <div className="flex gap-1 mt-2">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 h-1.5 rounded-full ${i < Math.round(score) ? "bg-orange-400" : "bg-gray-200"}`}
        />
      ))}
    </div>
  );
}

/** Read-only rating pill row — highlights up to the stored value */
function RatingPills({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold ${
            i < value ? "bg-orange-400 text-white" : "bg-gray-100 text-gray-400"
          }`}
        >
          {i + 1}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FinalDecisionPage() {
  const params = useParams();
  const router = useRouter();
  const vacancyId = params.id as string;
  const candidateId = params.candidateId as string;

  const searchParams = useSearchParams();
  const fromEvaluated = searchParams.get("from") === "evaluated";
  const backHref = fromEvaluated ? `/recruitment/${vacancyId}?tab=evaluated` : `/recruitment/${vacancyId}`;

  const [data, setData] = useState<FinalDecisionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [myPanelRole, setMyPanelRole] = useState<"head" | "member" | null>(null);
  const [completionData, setCompletionData] = useState<any>(null);
  const [previousRoundsOpen, setPreviousRoundsOpen] = useState(false);

  const [selectedDecision, setSelectedDecision] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill if a decision already exists, fetch role and completion status
  useEffect(() => {
    let appId: number;

    apiFetch(`/recruitment/candidates/${candidateId}`)
      .then((r) => r.json())
      .then((cand) => {
        appId = cand.application_id;
        // Determine the current active round based on candidate status.
        // In a real system, you'd track active round precisely, but this matches evaluate/page.tsx logic:
        let currentRound = 1;
        if (cand.status === "Second Round") currentRound = 2;
        else if (cand.status === "Job Offered" || cand.status === "Rejected") currentRound = -1; // Process over

        // Fetch all required data concurrently
        return Promise.all([
          apiFetch(`/recruitment/applications/${appId}/final-decision-view`).then(r => r.json()),
          apiFetch(`/recruitment/vacancies/${vacancyId}/my-panel-role`).then(r => r.json()),
          // Only fetch completion if we have a valid round to check
          currentRound > 0 
            ? apiFetch(`/recruitment/applications/${appId}/panel-completion?vacancy_id=${vacancyId}&round_number=${currentRound}`).then(r => r.json())
            : Promise.resolve({ all_submitted: true, pending: [] })
        ]);
      })
      .then(([d, roleData, compData]) => {
        setData(d as FinalDecisionData);
        setMyPanelRole(roleData.role);
        setCompletionData(compData);

        if ((d as FinalDecisionData).final_decision) {
          setSelectedDecision((d as FinalDecisionData).final_decision!.decision);
          setNotes((d as FinalDecisionData).final_decision!.notes ?? "");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [candidateId, vacancyId]);

  const handleConfirm = async () => {
    if (!selectedDecision) {
      setError("Please select a decision before confirming.");
      return;
    }
    if (!data) return;
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch(`/recruitment/applications/${data.application_id}/final-decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: selectedDecision, notes }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setError(err?.detail ?? "Failed to save decision.");
        setSaving(false);
        return;
      }
      
      // If panel head chose another round, notify backend to increment round
      if (selectedDecision === "Proceed to Next Round") {
        await apiFetch(`/recruitment/applications/${data.application_id}/next-round`,
          { method: "POST" }
        ).catch(() => {}); // best-effort — the decision is already saved
      }

      // Navigate back to the evaluated tab — keep saving=true to prevent button glitch
      router.push(`/recruitment/${vacancyId}?tab=evaluated`);
    } catch {
      setError("Could not connect to the server.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400 text-sm">
        Loading evaluation data...
      </div>
    );
  }

  if (myPanelRole !== "head") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-gray-800">Access Restricted</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          The Final Decision page is only accessible to the Panel Head for this vacancy.
        </p>
        <Link
          href={`/recruitment/${vacancyId}/candidates/${candidateId}`}
          className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-orange-400 hover:bg-orange-500 text-white text-sm font-medium rounded-xl transition"
        >
          ← Back to Candidate
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400 text-sm">
        No evaluation data found.{" "}
        <Link href={`/recruitment/${vacancyId}`} className="text-orange-500 ml-1">
          Go back
        </Link>
      </div>
    );
  }

  const {
    candidate,
    vacancy,
    evaluations,
    category_averages,
    panel_avg_score,
    evaluator_count,
    current_round,
    previous_rounds,
  } = data;

  return (
    <>
          {/* Back */}
          <button
            onClick={() => router.push(backHref)}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
          >
            ← Back
          </button>

          <h2 className="text-2xl font-bold text-gray-800">Final Decision – Round {current_round}</h2>
          <p className="text-sm text-gray-400 mb-6">Review all panel evaluations for this round and make the hiring decision</p>


          {/* Candidate header card */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-400 text-white flex items-center justify-center font-bold text-lg shrink-0">
                {initials(candidate.full_name)}
              </div>
              <div>
                <p className="text-base font-bold text-gray-800">{candidate.full_name}</p>
                <p className="text-sm text-gray-500">{vacancy.title}</p>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Evaluated by {evaluator_count} panel member{evaluator_count !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Panel Average Score widget */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-8 py-4 text-center shrink-0">
              <p className="text-xs text-gray-500 mb-1">Panel Average</p>
              <p className="text-3xl font-bold text-orange-500">{Math.round(panel_avg_score)}%</p>
              <p className="text-xs text-gray-400">Overall Score</p>
            </div>
          </div>

          {/* Average ratings by category */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-5">Average Ratings by Category</h3>
            <div className="grid grid-cols-5 gap-4">
              {CRITERIA.map((c) => {
                const val = category_averages[c.key];
                return (
                  <div key={c.key}>
                    <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {val.toFixed(1)}{" "}
                      <span className="text-sm font-normal text-gray-400">/5</span>
                    </p>
                    <SegmentBar score={val} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Panel Evaluations — current round only */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-sm font-bold text-gray-700">
                Panel Evaluations — Round {current_round}
              </h3>
              <span className="text-xs bg-orange-100 text-orange-600 font-semibold px-2.5 py-0.5 rounded-full">
                Current Round
              </span>
            </div>

            {evaluations.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-500 text-center">
                No evaluations submitted for this round yet.
              </div>
            ) : (
              <div className="space-y-4">
                {evaluations.map((ev, idx) => {
                  const label = ev.evaluator_name ?? `Evaluator ${idx + 1}`;
                  const isHead = idx === 0;
                  return (
                    <div key={ev.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isHead ? "bg-orange-400 text-white" : "bg-gray-200 text-gray-600"}`}>
                            {initials(label)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{label}</p>
                            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${isHead ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"}`}>
                              {isHead ? "Panel Head" : "Panel Member"}
                            </span>
                          </div>
                        </div>
                        <p className="text-2xl font-bold text-orange-500">
                          {Math.round(ev.overall_score)}%
                          <span className="text-sm font-normal text-gray-400 ml-1">Score</span>
                        </p>
                      </div>

                      <div className="grid grid-cols-5 gap-4 mb-4">
                        {CRITERIA.map((c) => {
                          const val = ev[c.key as keyof Evaluation] as number;
                          return (
                            <div key={c.key}>
                              <p className="text-xs text-gray-400 mb-2">{c.label}</p>
                              <RatingPills value={val} />
                              <p className="text-xs text-gray-400 mt-1">{val} out of 5</p>
                            </div>
                          );
                        })}
                      </div>

                      {ev.comments && (
                        <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                          <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Comments
                          </p>
                          <p className="text-sm text-gray-600">{ev.comments}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Previous Rounds — collapsible historical reference */}
          {previous_rounds && Object.keys(previous_rounds).length > 0 && (
            <div className="mb-6 border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setPreviousRoundsOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition text-left"
              >
                <span className="text-sm font-semibold text-gray-600">
                  Previous Rounds ({Object.keys(previous_rounds).length})
                  <span className="text-xs font-normal text-gray-400 ml-2">— for reference only, not included in averages</span>
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${previousRoundsOpen ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {previousRoundsOpen && (
                <div className="p-5 space-y-6 bg-white">
                  {Object.entries(previous_rounds)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([roundNum, roundEvals]) => {
                      const avg = roundEvals.length > 0
                        ? Math.round(roundEvals.reduce((s, e) => s + e.overall_score, 0) / roundEvals.length)
                        : 0;
                      return (
                        <div key={roundNum}>
                          <div className="flex items-center gap-3 mb-3">
                            <span className="bg-gray-100 text-gray-500 text-xs font-bold px-3 py-1 rounded-full">
                              Round {roundNum}
                            </span>
                            <span className="text-xs text-gray-400">
                              {roundEvals.length} evaluation{roundEvals.length !== 1 ? "s" : ""} · Avg: {avg}%
                            </span>
                          </div>
                          <div className="space-y-3">
                            {(roundEvals as Evaluation[]).map((ev, idx) => {
                              const label = ev.evaluator_name ?? `Evaluator ${idx + 1}`;
                              return (
                                <div key={ev.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-700">{label}</p>
                                    {ev.comments && (
                                      <p className="text-xs text-gray-500 mt-1 italic">"{ev.comments}"</p>
                                    )}
                                  </div>
                                  <p className="text-lg font-bold text-gray-500 shrink-0">
                                    {Math.round(ev.overall_score)}%
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Make Final Decision */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-base font-bold text-gray-800 mb-1">Make Final Decision</h3>
            <p className="text-sm text-gray-400 mb-6">Consider all panel evaluations before deciding</p>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {completionData && !completionData.all_submitted ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Pending Evaluations</p>
                    <p className="text-sm text-amber-700 mt-1">
                      You cannot make the final decision until all panel members have submitted their evaluations for this round.
                    </p>
                    <ul className="mt-3 space-y-1.5">
                      {completionData.pending.map((p: any) => (
                        <li key={p.user_id} className="text-sm text-amber-800 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full inline-block"></span>
                          <span className="font-medium">{p.full_name}</span>
                          <span className="text-xs opacity-75">({p.role === "head" ? "Panel Head" : "Panel Member"})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Decision cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
              {DECISIONS.map((d) => {
                const active = selectedDecision === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedDecision(d.id); setError(null); }}
                    className={`rounded-xl border-2 py-8 flex flex-col items-center gap-2 transition ${
                      active
                        ? "bg-orange-400 border-orange-400 text-white"
                        : "bg-white border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-500"
                    }`}
                  >
                    <span className="text-2xl">{d.icon}</span>
                    <span className="font-semibold text-sm">{d.label}</span>
                    <span className={`text-xs ${active ? "text-orange-100" : "text-gray-400"}`}>
                      {d.sub}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Final Decision Notes */}
            <p className="text-sm font-medium text-gray-700 mb-2">Final Decision Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain your decision reasoning, considering all panel evaluations and scores..."
              className="w-full border border-gray-200 rounded-xl p-4 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 resize-none h-28"
            />

            {/* Actions */}
            <div className="flex justify-between mt-6">
              <button
                onClick={() => router.back()}
                className="px-8 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving}
                className="w-48 h-12 bg-orange-400 hover:bg-orange-500 disabled:bg-orange-400 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  "Confirm Decision"
                )}
              </button>
                </div>
              </>
            )}
          </div>
    </>
  );
}
