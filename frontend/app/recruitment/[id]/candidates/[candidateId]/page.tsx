"use client";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/lib/constants";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { IconChevron } from "@/components/Icons";
import { useAuth } from "@/context/auth-context";

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
  active_round?: number;
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

  const { user } = useAuth();

  const [panel, setPanel] = useState<any>(null);
  const [myPanelRole, setMyPanelRole] = useState<"head" | "member" | null>(null);
  const [myEvaluationSubmitted, setMyEvaluationSubmitted] = useState(false);
  const [completionData, setCompletionData] = useState<any>(null);
  const [currentRound, setCurrentRound] = useState(1);

  // Ref for the auto-poll interval (panel head waiting for members)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // hasNotes: candidate already has notes saved (loaded from DB) — controls structural UI
  const [hasNotes, setHasNotes] = useState(false);
  // justSaved: user just clicked Save in this session — drives the transient toast only
  const [justSaved, setJustSaved] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  // Manual email entry when AI couldn't extract one
  const [manualEmail, setManualEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // Edit details state
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  /** True only when the candidate has a real, sendable email on file */
  const hasValidEmail = (email?: string | null) =>
    !!email && email.includes("@") &&
    !["Processing...", "placeholder@email.com", ""].includes(email.trim());

  useEffect(() => {

    apiFetch(`/recruitment/candidates/${candidateId}`)
      .then(res => res.json())
      .then(data => {

        setCandidate(data);
        setNotes(data.notes?.trim() ?? "");
        setApplicationId(data.application_id);
        setEditFullName(data.full_name || "");
        setEditPhone(data.phone || "");
        setEditEmail(data.email || "");

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

    // Fetch interview panel + my panel role in parallel (don't need applicationId)
    apiFetch(`/recruitment/vacancies/${vacancyId}/panel`)
      .then(res => { if (res.ok) return res.json(); return null; })
      .then(data => setPanel(data))
      .catch(console.error);

    apiFetch(`/recruitment/vacancies/${vacancyId}/my-panel-role`)
      .then(res => { if (res.ok) return res.json(); return { role: null }; })
      .then(data => setMyPanelRole(data.role))
      .catch(console.error);

  }, [candidateId, vacancyId]);


  // ── Secondary: fetch submission status + completion (needs applicationId + round) ──
  useEffect(() => {
    if (!applicationId || !candidate) return;

    // Determine which round is active — use the authoritative active_round field
    let round = candidate?.active_round ?? 1;
    setCurrentRound(round);

    // Only relevant when interview is active (not yet decided)
    const isActive = ["Called", "First Round", "Second Round"].includes(candidate?.status ?? "") ||
      (candidate?.status ?? "").startsWith("Interview Round");
    if (!isActive || !myPanelRole) return;

    const fetchStatus = async () => {
      const [evalRes, compRes] = await Promise.all([
        apiFetch(`/recruitment/applications/${applicationId}/my-evaluation-status?round_number=${round}`),
        apiFetch(`/recruitment/applications/${applicationId}/panel-completion?vacancy_id=${vacancyId}&round_number=${round}`),
      ]);
      if (evalRes.ok) {
        const d = await evalRes.json();
        setMyEvaluationSubmitted(d.submitted);
      }
      if (compRes.ok) {
        const d = await compRes.json();
        setCompletionData(d);
      }
    };

    fetchStatus().catch(console.error);
  }, [applicationId, candidate?.status, myPanelRole, vacancyId]);


  // ── Auto-poll: panel head waiting for members (15s interval) ──────────────
  useEffect(() => {
    // Only poll when head has submitted but some members are still pending
    const shouldPoll =
      myPanelRole === "head" &&
      myEvaluationSubmitted &&
      completionData &&
      !completionData.all_submitted &&
      !!applicationId;

    if (!shouldPoll) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    const poll = async () => {
      try {
        const res = await apiFetch(
          `/recruitment/applications/${applicationId}/panel-completion?vacancy_id=${vacancyId}&round_number=${currentRound}`
        );
        if (res.ok) setCompletionData(await res.json());
      } catch { /* swallow — non-critical */ }
    };

    pollRef.current = setInterval(poll, 15_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [myPanelRole, myEvaluationSubmitted, completionData?.all_submitted, applicationId, vacancyId, currentRound]);


  const saveNotes = async () => {
    if (!applicationId) return;

    if (!notes.trim()) {
      setNotesError("Call notes are required before marking as called.");
      return;
    }

    setNotesError(null);
    const res = await apiFetch(`/recruitment/applications/${applicationId}`,
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
    setCandidate((prev) => prev ? { ...prev, status: "Called" } : prev);

    // Show the transient success toast, then auto-dismiss after 3 s
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3000);
  };

  const sendLink = async () => {
    if (!applicationId) return;
    setSendingEmail(true);
    try {
      const res = await apiFetch(`/recruitment/applications/${applicationId}/send-scheduling-link`, {
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

  const saveDetails = async () => {
    setSavingDetails(true);
    try {
      const res = await apiFetch(`/recruitment/candidates/${candidateId}/details`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name: editFullName, phone: editPhone, email: editEmail }),
        }
      );
      if (!res.ok) {
        alert("Failed to save details. Please try again.");
        return;
      }
      setCandidate(prev => prev ? { ...prev, full_name: editFullName, phone: editPhone, email: editEmail } : prev);
      setIsEditingDetails(false);
    } catch {
      alert("Could not connect to server.");
    }
    setSavingDetails(false);
  };

  const saveEmail = async () => {
    if (!manualEmail.includes("@")) {
      alert("Please enter a valid email address.");
      return;
    }
    setSavingEmail(true);
    try {
      const res = await apiFetch(`/recruitment/candidates/${candidateId}/details`,
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
    <>

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
                (() => {
                  // Stored path may be an OS-absolute path (Windows uses "\", POSIX uses "/"),
                  // so split on both separators to reliably extract just the UUID filename.
                  const cvFilename = candidate.cv_file_path!.split(/[\\/]/).pop() || candidate.cv_file_path!;
                  const cvUrl = `${API_BASE_URL}/recruitment/files/${cvFilename}`;
                  const isDocx = cvFilename.toLowerCase().endsWith('.docx');
                  return (
                    <>
                      <div className="flex justify-between items-center mb-3">
                        <p className="text-sm text-gray-500">CV Preview</p>
                        <a
                          href={cvUrl}
                          download
                          className="text-xs text-orange-500 hover:text-orange-600 font-medium border border-orange-300 px-3 py-1 rounded-lg transition"
                        >
                          ↓ Download CV
                        </a>
                      </div>
                      {isDocx ? (
                        <div className="w-full h-[620px] border border-gray-200 rounded-lg flex flex-col items-center justify-center gap-4 bg-gray-50">
                          <svg className="w-16 h-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-sm text-gray-500">DOCX files cannot be previewed in the browser.</p>
                          <a
                            href={cvUrl}
                            download
                            className="bg-orange-400 hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition"
                          >
                            Download to View
                          </a>
                        </div>
                      ) : (
                        <iframe
                          src={cvUrl}
                          className="w-full h-[620px] border border-gray-200 rounded-lg"
                        />
                      )}
                    </>
                  );
                })()
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
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Details
                  </h3>
                  {!isEditingDetails ? (
                    <button
                      onClick={() => setIsEditingDetails(true)}
                      className="text-orange-500 hover:text-orange-600 text-sm font-medium transition"
                    >
                      Edit Info
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditingDetails(false)}
                        className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveDetails}
                        disabled={savingDetails}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {savingDetails ? "Saving..." : "Save"}
                      </button>
                    </div>
                  )}
                </div>

                {!isEditingDetails ? (
                  <>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="text-sm text-gray-700 mb-3">
                      {candidate.full_name}
                    </p>

                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="text-sm text-gray-700 mb-3">
                      {candidate.phone || "Not provided"}
                    </p>

                    <p className="text-sm text-gray-500">Email</p>
                    <p className="text-sm text-gray-700 mb-3">
                      {candidate.email || "Not provided"}
                    </p>
                  </>
                ) : (
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Name</label>
                      <input
                        type="text"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Phone</label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Email</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                      />
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-500">AI Match Score</p>
                <div className="mb-4">
                  <p className="text-sm text-gray-700 font-medium">
                    {candidate.ai_score != null ? `${candidate.ai_score}%` : "Processing..."}
                  </p>
                  {candidate.ai_reasoning && (
                    <p className="text-xs text-gray-500 mt-1 italic leading-relaxed">
                      &ldquo;{candidate.ai_reasoning}&rdquo;
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
                  onChange={(e) => { setNotes(e.target.value); if (e.target.value.trim()) setNotesError(null); }}
                  disabled={hasNotes}
                  placeholder="Write notes from the initial screening call..."
                  className={`w-full border rounded-lg p-3 text-sm h-28 text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-gray-500 ${
                    notesError
                      ? "border-red-300 ring-2 ring-red-100 focus:ring-red-200 focus:border-red-400"
                      : "border-gray-200 focus:ring-orange-200 focus:border-orange-300"
                  }`}
                />

                {notesError && (
                  <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                    <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {notesError}
                  </p>
                )}

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

              {/* Interview Scheduling Section — only visible while candidate is in 'Called' state */}
              {hasNotes && candidate?.status === "Called" && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Interview Scheduling
                  </h3>

                  {(!panel || !panel.panel_head_id || !panel.interview_link) ? (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 text-sm">
                      <p className="font-medium mb-1">Missing Interview Panel</p>
                      <p>To send an interview link, please set up an interview panel with a Panel Head and a scheduling link for this vacancy.</p>
                      <Link href={`/recruitment/${vacancyId}/edit`} className="text-orange-500 hover:underline mt-2 inline-block font-medium">
                        Add interview Panel
                      </Link>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {/* Send email section — only for the first round invitation */}
                      {!linkSent && candidate?.status === "Called" && (
                        <div>
                          {!hasValidEmail(candidate?.email) ? (
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

                      {/* Confirmation after email sent in this session */}
                      {linkSent && (
                        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mt-4">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                          <span className="text-sm font-medium">Scheduling link sent to {candidate?.email}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Panel Actions — sequential, role-aware, independent of scheduling card */}
              {(linkSent || candidate?.status === "First Round" || candidate?.status === "Second Round" || (candidate?.status ?? "").startsWith("Interview Round")) && myPanelRole && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    Panel Actions (Round {currentRound})
                  </h3>

                  <div className="flex flex-col gap-2">
                    {/* Not yet evaluated — show Evaluate button */}
                    {!myEvaluationSubmitted && (
                      <Link
                        href={`/recruitment/${vacancyId}/candidates/${candidateId}/evaluate`}
                        className="w-full bg-orange-400 hover:bg-orange-500 text-white flex items-center justify-center py-2.5 rounded-xl text-sm font-medium transition"
                      >
                        Evaluate Candidate
                      </Link>
                    )}

                    {/* Already evaluated — show submitted confirmation */}
                    {myEvaluationSubmitted && (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-2.5">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <span className="text-sm font-medium">Your evaluation has been submitted for this round.</span>
                      </div>
                    )}

                    {/* Panel head only: final decision or pending list */}
                    {myPanelRole === "head" && myEvaluationSubmitted && (
                      completionData?.all_submitted ? (
                        <Link
                          href={`/recruitment/${vacancyId}/candidates/${candidateId}/final-decision`}
                          className="w-full bg-white border border-orange-400 text-orange-500 hover:bg-orange-50 flex items-center justify-center py-2.5 rounded-xl text-sm font-medium transition mt-1"
                        >
                          View All Evaluations &amp; Decide
                        </Link>
                      ) : completionData?.pending?.length > 0 ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mt-1">
                          <p className="text-xs font-semibold text-gray-600 mb-2">Awaiting evaluations from:</p>
                          <ul className="space-y-1">
                            {completionData.pending.map((p: any) => (
                              <li key={p.user_id} className="text-sm text-gray-700 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0"></span>
                                {p.full_name}
                                <span className="text-xs text-gray-400">({p.role === "head" ? "Panel Head" : "Panel Member"})</span>
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs text-gray-400 mt-2">This page updates automatically.</p>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}


            </div>

          </div>

    </>
  );
}