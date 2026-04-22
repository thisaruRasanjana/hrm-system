"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";

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
  const vacancyId = params.id as string;
  const candidateId = params.candidateId as string;

  const [loading, setLoading] = useState(true);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [saving, setSaving] = useState(false);
  const [roundNumber, setRoundNumber] = useState(1);

  // TODO: Replace with identity from Auth context once auth module is implemented
  const [evaluatorName, setEvaluatorName] = useState("");

  const [ratings, setRatings] = useState({
    technical_skills: 0,
    problem_solving: 0,
    communication: 0,
    cultural_fit: 0,
    attitude: 0
  });
  const [comments, setComments] = useState("");
  const [needsRound, setNeedsRound] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/candidates/${candidateId}`).then(r => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/vacancies/${vacancyId}`).then(r => r.json())
    ])
    .then(([candData, vacData]) => {
      setCandidate(candData);
      setVacancy(vacData);
      // Fetch existing evaluations to determine the round number
      return fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/applications/${candData.application_id}/evaluations`);
    })
    .then(r => r.json())
    .then((evals: any[]) => {
      // Determine current round: all panel members for a given phase share the
      // same round_number. Round increments only when the panel head decides
      // "Proceed to Next Round" as a final decision.
      const maxRound =
        Array.isArray(evals) && evals.length > 0
          ? Math.max(...evals.map((e: any) => e.round_number))
          : 0;
      setRoundNumber(maxRound > 0 ? maxRound : 1);
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/applications/${candidate.application_id}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...ratings,
          round_number: roundNumber,
          comments,
          needs_another_round: needsRound,
          evaluator_name: evaluatorName.trim() || "Anonymous",
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
    <div className="flex bg-gray-50 h-screen overflow-hidden">
      <Sidebar activePath="/recruitment" />
      
      <div className="flex-1 flex flex-col">
        <TopBar />
        
        <main className="flex-1 overflow-y-auto p-8">
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

              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Evaluator Name</h3>
                <input
                  type="text"
                  value={evaluatorName}
                  onChange={(e) => setEvaluatorName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                />
                <p className="text-xs text-gray-400 mt-1">Required to prevent duplicate submissions</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">Needs another round</span>
                <button
                  type="button"
                  onClick={() => setNeedsRound(!needsRound)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    needsRound ? "bg-orange-400" : "bg-gray-200"
                  }`}
                >
                  <span className="sr-only">Enable next round</span>
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      needsRound ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

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

        </main>
      </div>
    </div>
  );
}
