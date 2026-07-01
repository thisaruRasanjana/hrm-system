"use client";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/lib/constants";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";

type Candidate = {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  application_id: number;
};

type Vacancy = {
  title: string;
};

const criteriaList = [
  { key: "technical_skills", label: "Technical Skills" },
  { key: "problem_solving", label: "Problem Solving" },
  { key: "communication", label: "Communication" },
  { key: "cultural_fit", label: "Cultural Fit" },
  { key: "attitude", label: "Attitude" }
] as const;

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function EvaluateInterviewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const vacancyId = params.id as string;
  const candidateId = params.candidateId as string;

  const [loading, setLoading] = useState(true);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [saving, setSaving] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);

  const { user } = useAuth();
  const evaluatorName = user ? `${user.first_name} ${user.last_name}` : "Anonymous";
  const [ratings, setRatings] = useState({
    technical_skills: 0,
    problem_solving: 0,
    communication: 0,
    cultural_fit: 0,
    attitude: 0
  });
  const [comments, setComments] = useState("");

  useEffect(() => {
    let resolvedCandidate: any = null;

    Promise.all([
      apiFetch(`/recruitment/candidates/${candidateId}`).then(r => r.json()),
      apiFetch(`/recruitment/vacancies/${vacancyId}`).then(r => r.json()),
      apiFetch(`/recruitment/vacancies/${vacancyId}/my-panel-role`).then(r => r.json()),
    ])
    .then(([candData, vacData, roleData]) => {
      // Guard: must be on the interview panel
      if (!roleData.role) {
        alert("Evaluation is restricted to the interview panel members for this vacancy.");
        router.push(`/recruitment/${vacancyId}/candidates/${candidateId}`);
        return Promise.reject("Not on panel");
      }

      resolvedCandidate = candData;
      setCandidate(candData);
      setVacancy(vacData);
      // Fetch existing evaluations to determine the round number
      return apiFetch(`/recruitment/applications/${candData.application_id}/evaluations`);
    })
    .then(r => r.json())
    .then(async (_evals: any[]) => {
      // Use active_round from the candidate response — authoritative source.
      // Falls back to 1 for any candidate without an explicit active_round.
      const currentRound = resolvedCandidate?.active_round ?? 1;
      setRoundNumber(currentRound);
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [candidateId, vacancyId]);

  const updateRating = (key: keyof typeof ratings, val: number) => {
    setRatings(prev => ({ ...prev, [key]: val }));
  };

  const calculateScore = () => {
    const total = Object.values(ratings).reduce((a, b) => a + b, 0);
    return Math.round((total / 25) * 100);
  };

  const getProgressSegments = () => {
    const ratedCount = Object.values(ratings).filter(v => v > 0).length;
    return Array.from({ length: 5 }).map((_, i) => i < ratedCount);
  };

  const handleSave = async () => {
    if (!candidate?.application_id) return;

    // Validate all 5 criteria are rated (spec §9.2)
    const unrated = Object.entries(ratings).filter(([, val]) => val === 0);
    if (unrated.length > 0) {
      alert("Please rate all 5 evaluation criteria before saving.");
      return;
    }

    setSaving(true);
    
    try {
      const res = await apiFetch(`/recruitment/applications/${candidate.application_id}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...ratings,
          round_number: roundNumber,
          comments,
          needs_another_round: false,
          evaluator_name: evaluatorName.trim() || "Anonymous",
          evaluator_user_id: user?.id,
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.detail || "Failed to save evaluation");
        setSaving(false);
        return;
      }

      router.push(`/recruitment/${vacancyId}/candidates/${candidateId}`);
    } catch (err) {
      console.error(err);
      alert("Could not connect to server");
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-gray-500">Loading...</div>;
  }

  return (
    <>
      <Link
            href={`/recruitment/${vacancyId}/candidates/${candidateId}`}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
          >
            ← Back
          </Link>

          {/* Title + round badge */}
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Interview Evaluation
            </h2>
            <span className="bg-orange-100 text-orange-600 text-xs font-semibold px-3 py-1 rounded-full">
              {ordinal(roundNumber)} Round
            </span>
          </div>

          {/* Candidate info header */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6 flex flex-wrap gap-6 items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">Candidate</p>
              <p className="text-sm font-semibold text-gray-800">{candidate?.full_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Position</p>
              <p className="text-sm font-semibold text-gray-800">{vacancy?.title}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Phone</p>
              <p className="text-sm font-semibold text-gray-800">{candidate?.phone || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Interview Type</p>
              <p className="text-sm font-semibold text-gray-800">Online – {ordinal(roundNumber)} Round</p>
            </div>
          </div>

          <div className="flex gap-6">
            {/* Left: Ratings */}
            <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm p-8">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Rate Candidate</h3>
              
              <div className="space-y-6">
                {criteriaList.map((crit) => (
                  <div key={crit.key}>
                    <p className="text-sm text-gray-600 mb-3">{crit.label}</p>
                    <div className="flex gap-3">
                      {[1, 2, 3, 4, 5].map(num => {
                        const active = ratings[crit.key as keyof typeof ratings] >= num;
                        return (
                          <button
                            key={num}
                            onClick={() => updateRating(crit.key as keyof typeof ratings, num)}
                            className={`w-12 h-10 rounded-lg text-sm font-semibold transition ${
                              active ? "bg-orange-400 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }`}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Score + comments + progress + evaluator + toggle + actions */}
            <div className="w-[350px] flex flex-col gap-4">

              <div className="bg-orange-400 text-white rounded-xl shadow-sm p-6 flex flex-col items-center justify-center h-40">
                <p className="text-sm font-medium mb-1 opacity-90">Overall Score</p>
                <p className="text-5xl font-bold mb-2">{calculateScore()}%</p>
                <p className="text-xs opacity-80">Based on ratings</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Panel Comments</h3>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Share your observations, key strengths, areas of improvement..."
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 resize-none h-28"
                />
              </div>

              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Evaluation Progress</h3>
                <div className="flex gap-1">
                  {getProgressSegments().map((filled, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-2 rounded-full ${filled ? "bg-orange-400" : "bg-gray-200"}`}
                    />
                  ))}
                </div>
              </div>

              {/* Removed manual name input */}
              {/* Actions — anchored to the bottom of the right column */}
              <div className="flex gap-3">
                <button
                  onClick={() => router.back()}
                  className="flex-1 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 bg-orange-400 disabled:opacity-60 hover:bg-orange-500 rounded-xl text-white text-sm font-medium transition"
                >
                  {saving ? "Saving..." : "Save Evaluation"}
                </button>
              </div>

            </div>
          </div>

    </>
  );
}
