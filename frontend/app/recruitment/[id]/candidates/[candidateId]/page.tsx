"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";
import { IconChevron } from "@/components/Icons";

type Candidate = {
  id: number;
  full_name: string;
  phone: string;
  email?: string;
  ai_score?: number | null;
  ai_reasoning?: string | null;
  cv_file_path?: string;
  application_id: number;
  status: string;
  notes?: string;
};

// SelectBox removed — status is now automatically managed by the backend workflow

export default function CandidateProfilePage() {

  const params = useParams();

  const vacancyId = params.id as string;
  const candidateId = params.candidateId as string;

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [notes, setNotes] = useState("");
  const [applicationId, setApplicationId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);

  const [panel, setPanel] = useState<any>(null);
  // hasNotes: candidate already has notes saved (loaded from DB) — controls structural UI
  const [hasNotes, setHasNotes] = useState(false);
  // justSaved: user just clicked Save in this session — drives the transient toast only
  const [justSaved, setJustSaved] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  // Manual email entry when AI couldn't extract one
  const [manualEmail, setManualEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  /** True only when the candidate has a real, sendable email on file */
  const hasValidEmail = (email?: string | null) =>
    !!email && email.includes("@") &&
    !["Processing...", "placeholder@email.com", ""].includes(email.trim());

  useEffect(() => {

    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/candidates/${candidateId}`)
      .then(res => res.json())
      .then(data => {

        setCandidate(data);
        setNotes(data.notes?.trim() ?? "");
        setApplicationId(data.application_id);

        // Show the scheduling section if the candidate has already been called or has notes
        if (data.status === "Called" || (data.notes && data.notes.trim() !== "")) {
          setHasNotes(true);   // structural only — does NOT trigger the success toast
        }

        setLoading(false);

      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });

    // Fetch interview panel for the vacancy
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/vacancies/${vacancyId}/panel`)
      .then(res => {
        if (res.ok) return res.json();
        return null;
      })
      .then(data => setPanel(data))
      .catch(console.error);

  }, [candidateId, vacancyId]);

  const saveNotes = async () => {
    if (!applicationId) return;

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/applications/${applicationId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Status is NOT sent — backend automatically sets it to "Called" (spec §1.4.1)
        body: JSON.stringify({ notes }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      alert(err?.detail || "Failed to save notes. Please try again.");
      return;
    }

    setHasNotes(true);

    // Show the transient success toast, then auto-dismiss after 3 s
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3000);
  };

  const sendLink = async () => {
    if (!applicationId) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/applications/${applicationId}/send-scheduling-link`, {
        method: "POST"
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        alert(errData?.detail || "Failed to send email");
      } else {
        setLinkSent(true);
      }
    } catch (err) {
      console.error(err);
      alert("Could not connect to server.");
    }
    setSendingEmail(false);
  };

  const saveEmail = async () => {
    if (!manualEmail.includes("@")) {
      alert("Please enter a valid email address.");
      return;
    }
    setSavingEmail(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/candidates/${candidateId}/email`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: manualEmail }),
        }
      );
      if (!res.ok) {
        alert("Failed to save email. Please try again.");
        return;
      }
      // Update local candidate state so the send button appears immediately
      setCandidate(prev => prev ? { ...prev, email: manualEmail } : prev);
    } catch {
      alert("Could not connect to server.");
    }
    setSavingEmail(false);
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center text-gray-500">
        Loading candidate...
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center text-gray-500">
        Candidate not found
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      <Sidebar activePath="/recruitment" />

      <div className="flex-1 flex flex-col">

        <TopBar />

        <main className="flex-1 overflow-y-auto p-8">

          <Link
            href={`/recruitment/${vacancyId}`}
            className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block"
          >
            ← Back to Candidates
          </Link>

          <h1 className="text-2xl font-bold text-gray-800 mb-6">
            Candidate Profile
          </h1>

          <div className="grid grid-cols-3 gap-6">

            {/* CV Preview */}

            <div className="col-span-2 bg-white rounded-2xl border border-gray-200 p-6">

              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                CV Preview
              </h3>

              {candidate.cv_file_path ? (
                <>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm text-gray-500">CV Preview</p>
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/files/${candidate.cv_file_path}`}
                      download
                      className="text-xs text-orange-500 hover:text-orange-600 font-medium border border-orange-300 px-3 py-1 rounded-lg transition"
                    >
                      ↓ Download CV
                    </a>
                  </div>
                  <iframe
                    src={`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/files/${candidate.cv_file_path}`}
                    className="w-full h-[620px] border border-gray-200 rounded-lg"
                  />
                </>
              ) : (

                <div className="h-[650px] flex items-center justify-center text-gray-400 text-sm">
                  CV not available
                </div>

              )}

            </div>

            {/* Right Panel */}

            <div className="space-y-6">

              {/* Candidate Details */}

              <div className="bg-white rounded-2xl border border-gray-200 p-6">

                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Details
                </h3>

                <p className="text-sm text-gray-500">Name</p>
                <p className="text-sm text-gray-700 mb-3">
                  {candidate.full_name}
                </p>

                <p className="text-sm text-gray-500">Phone</p>
                <p className="text-sm text-gray-700 mb-3">
                  {candidate.phone}
                </p>

                {candidate.email && (
                  <>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="text-sm text-gray-700 mb-3">
                      {candidate.email}
                    </p>
                  </>
                )}

                <p className="text-sm text-gray-500">AI Match Score</p>
                <div className="mb-4">
                  <p className="text-sm text-gray-700 font-medium">
                    {candidate.ai_score != null ? `${candidate.ai_score}%` : "Processing..."}
                  </p>
                  {candidate.ai_reasoning && (
                    <p className="text-xs text-gray-500 mt-1 italic leading-relaxed">
                      "{candidate.ai_reasoning}"
                    </p>
                  )}
                </div>

              </div>

              {/* Status + Notes */}

              <div className="bg-white rounded-2xl border border-gray-200 p-6">

                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Status and Notes
                </h3>

                {/* Status is auto-managed — shown read-only */}
                <p className="text-sm text-gray-500 mb-1">Status</p>
                <p className="text-sm font-medium text-gray-700 mb-4">
                  {candidate.status ?? "Uploaded"}
                </p>

                <p className="text-sm text-gray-500 mb-2">Call Notes</p>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={hasNotes}
                  placeholder="Write notes from the initial screening call..."
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm h-28 text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 disabled:bg-gray-50 disabled:text-gray-500"
                />

                {!hasNotes && (
                  <button
                    onClick={saveNotes}
                    className="mt-4 w-full bg-orange-400 hover:bg-orange-500 text-white py-2.5 rounded-xl text-sm font-medium transition"
                  >
                    Save Notes &amp; Mark as Called
                  </button>
                )}

                {/* Transient success toast — only visible right after saving, never on revisit */}
                {justSaved && (
                  <div className="flex items-center gap-2.5 mt-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-green-700">Notes saved successfully</span>
                  </div>
                )}

              </div>

              {/* Interview Scheduling Section */}
              {hasNotes && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Interview Scheduling
                  </h3>

                  {(!panel || !panel.interview_link) ? (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 text-sm">
                      <p className="font-medium mb-1">Missing Interview Panel</p>
                      <p>To send an interview link, please set up an interview panel with a Cita link for this vacancy.</p>
                      <Link href={`/recruitment/${vacancyId}/edit`} className="text-orange-500 hover:underline mt-2 inline-block font-medium">
                        Add interview Panel
                      </Link>
                    </div>
                  ) : linkSent ? (
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 text-gray-800 font-medium mb-1">
                        <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        Scheduling link sent !
                      </div>
                      <p className="text-xs text-gray-500 mb-6">
                        Email sent to {candidate?.email || "placeholder@email.com"}
                      </p>

                      <Link
                        href={`/recruitment/${vacancyId}/candidates/${candidateId}/evaluate`}
                        className="w-full bg-orange-400 hover:bg-orange-500 text-white flex items-center justify-center py-2.5 rounded-xl text-sm font-medium transition"
                      >
                        Evaluate the interview
                      </Link>
                    </div>
                  ) : (
                    <div>
                      {!hasValidEmail(candidate?.email) ? (
                        // ── No email on file — show inline entry form ──
                        <div>
                          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-amber-800">No email address on file</p>
                              <p className="text-xs text-amber-700 mt-0.5">
                                {candidate?.email === "Processing..."
                                  ? "AI is still processing this CV. You can add the email manually below."
                                  : "AI could not extract an email from this CV. Enter the candidate\u2019s email to send the interview link."}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="email"
                              value={manualEmail}
                              onChange={(e) => setManualEmail(e.target.value)}
                              placeholder="candidate@email.com"
                              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                            />
                            <button
                              onClick={saveEmail}
                              disabled={savingEmail}
                              className="px-4 py-2.5 bg-orange-400 hover:bg-orange-500 disabled:opacity-60 text-white rounded-xl text-sm font-medium transition"
                            >
                              {savingEmail ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        // ── Email exists — show send button ──
                        <div>
                          <p className="text-sm text-gray-500 mb-4">
                            Scheduling link will be sent to <span className="font-medium text-gray-700">{candidate?.email}</span>
                          </p>
                          <button
                            onClick={sendLink}
                            disabled={sendingEmail}
                            className="w-full bg-orange-400 hover:bg-orange-500 disabled:opacity-60 text-white flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                            </svg>
                            {sendingEmail ? "Sending..." : "Send Interview Scheduling Link"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>

          </div>

        </main>

      </div>

    </div>
  );
}