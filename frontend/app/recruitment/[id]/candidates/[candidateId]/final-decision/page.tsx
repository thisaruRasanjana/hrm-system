"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";
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
  evaluations: Evaluation[];
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
  const isPanelHead = searchParams.get("role") === "head";
  const fromEvaluated = searchParams.get("from") === "evaluated";
  const backHref = fromEvaluated ? `/recruitment/${vacancyId}?tab=evaluated` : `/recruitment/${vacancyId}`;

  const [data, setData] = useState<FinalDecisionData | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedDecision, setSelectedDecision] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill if a decision already exists
  useEffect(() => {
    fetch(`${API_BASE_URL}/recruitment/candidates/${candidateId}`)
      .then((r) => r.json())
      .then((cand) => {
        const appId = cand.application_id;
        return fetch(`${API_BASE_URL}/recruitment/applications/${appId}/final-decision-view`);
      })
      .then((r) => r.json())
      .then((d: FinalDecisionData) => {
        setData(d);
        if (d.final_decision) {
          setSelectedDecision(d.final_decision.decision);
          setNotes(d.final_decision.notes ?? "");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [candidateId]);

  const handleConfirm = async () => {
    if (!selectedDecision) {
      setError("Please select a decision before confirming.");
      return;
    }
    if (!data) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/recruitment/applications/${data.application_id}/final-decision`,
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
        await fetch(
          `${API_BASE_URL}/recruitment/applications/${data.application_id}/next-round`,
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

  if (!isPanelHead) {
    return (
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar activePath="/recruitment" />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-8">
            <button
              onClick={() => router.push(backHref)}
              className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
            >
              ← Back
            </button>
            <h2 className="text-2xl font-bold text-gray-800 mb-1">Panel Evaluation Summary</h2>
            <p className="text-sm text-gray-400 mb-6">All panel member evaluations for this candidate</p>

            {data && (() => {
              const { candidate, vacancy, evaluations, category_averages, panel_avg_score, evaluator_count } = data;
              // Group evaluations by round
              const rounds = evaluations.reduce<Record<number, typeof evaluations>>((acc, ev) => {
                const r = ev.round_number || 1;
                if (!acc[r]) acc[r] = [];
                acc[r].push(ev);
                return acc;
              }, {});
              const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);

              return (
                <>
                  {/* Candidate + score header */}
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-orange-400 text-white flex items-center justify-center font-bold text-lg shrink-0">
                        {initials(candidate.full_name)}
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-800">{candidate.full_name}</p>
                        <p className="text-sm text-gray-500">{vacancy.title}</p>
                        <p className="text-xs text-gray-400 mt-1">Evaluated by {evaluator_count} panel member{evaluator_count !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-xl px-8 py-4 text-center shrink-0">
                      <p className="text-xs text-gray-500 mb-1">Panel Average</p>
                      <p className="text-3xl font-bold text-orange-500">{Math.round(panel_avg_score)}%</p>
                      <p className="text-xs text-gray-400">Overall Score</p>
                    </div>
                  </div>

                  {/* Category averages */}
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

                  {/* Evaluations grouped by round */}
                  <div className="mb-6">
                    <h3 className="text-sm font-bold text-gray-700 mb-4">Panel Evaluations</h3>
                    <div className="space-y-6">
                      {roundNumbers.map((roundNum) => {
                        const roundEvals = rounds[roundNum];
                        const roundAvg = roundEvals.length > 0
                          ? Math.round(roundEvals.reduce((sum, e) => sum + e.overall_score, 0) / roundEvals.length)
                          : 0;
                        return (
                          <div key={roundNum}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className="bg-orange-100 text-orange-600 text-xs font-bold px-3 py-1 rounded-full">Round {roundNum}</span>
                                <span className="text-xs text-gray-400">{roundEvals.length} evaluation{roundEvals.length !== 1 ? "s" : ""}</span>
                              </div>
                              <span className="text-sm font-semibold text-gray-600">Avg: {roundAvg}%</span>
                            </div>
                            <div className="space-y-4">
                              {roundEvals.map((ev, idx) => {
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
                                        <p className="text-xs font-semibold text-gray-500 mb-1">Comments</p>
                                        <p className="text-sm text-gray-600">{ev.comments}</p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </main>
        </div>
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

  const { candidate, vacancy, evaluations, category_averages, panel_avg_score, evaluator_count } = data;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar activePath="/recruitment" />

      <div className="flex-1 flex flex-col">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-8">
          {/* Back */}
          <button
            onClick={() => router.push(backHref)}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
          >
            ← Back
          </button>

          <h2 className="text-2xl font-bold text-gray-800">Final Decision – Panel Head</h2>
          <p className="text-sm text-gray-400 mb-6">Review all evaluations and make the hiring decision</p>

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

          {/* Panel Evaluations — grouped by round */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-4">Panel Evaluations</h3>
            {(() => {
              // Group evaluations by round_number
              const rounds = evaluations.reduce<Record<number, typeof evaluations>>((acc, ev) => {
                const r = ev.round_number || 1;
                if (!acc[r]) acc[r] = [];
                acc[r].push(ev);
                return acc;
              }, {});
              const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);

              return (
                <div className="space-y-6">
                  {roundNumbers.map((roundNum) => {
                    const roundEvals = rounds[roundNum];
                    const roundAvg = roundEvals.length > 0
                      ? Math.round(roundEvals.reduce((sum, e) => sum + e.overall_score, 0) / roundEvals.length)
                      : 0;

                    return (
                      <div key={roundNum}>
                        {/* Round header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="bg-orange-100 text-orange-600 text-xs font-bold px-3 py-1 rounded-full">
                              Round {roundNum}
                            </span>
                            <span className="text-xs text-gray-400">
                              {roundEvals.length} evaluation{roundEvals.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-gray-600">
                            Avg: {roundAvg}%
                          </span>
                        </div>

                        {/* Evaluations for this round */}
                        <div className="space-y-4">
                          {roundEvals.map((ev, idx) => {
                            const label = ev.evaluator_name ?? `Evaluator ${idx + 1}`;
                            const isHead = idx === 0;
                            return (
                              <div key={ev.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                                {/* Evaluator header */}
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

                                {/* Per-category ratings */}
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

                                {/* Comments */}
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
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Make Final Decision */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-base font-bold text-gray-800 mb-1">Make Final Decision</h3>
            <p className="text-sm text-gray-400 mb-6">Consider all panel evaluations before deciding</p>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

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
          </div>
        </main>
      </div>
    </div>
  );
}
