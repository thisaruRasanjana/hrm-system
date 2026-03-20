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
  cv_file_path?: string;
  application_id: number;
  status: string;
  notes?: string;
};

function SelectBox({
  value,
  onChange,
  children,
  disabled
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="relative inline-flex items-center w-full">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="appearance-none w-full bg-white border border-gray-200 rounded-lg pl-4 pr-9 py-2.5 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 disabled:bg-gray-50 disabled:text-gray-500"
      >
        {children}
      </select>

      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <IconChevron />
      </span>
    </div>
  );
}

export default function CandidateProfilePage() {

  const params = useParams();

  const vacancyId = params.id as string;
  const candidateId = params.candidateId as string;

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [status, setStatus] = useState("Not Called");
  const [notes, setNotes] = useState("");
  const [applicationId, setApplicationId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  
  const [panel, setPanel] = useState<any>(null);
  const [notesSaved, setNotesSaved] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  useEffect(() => {

    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/candidates/${candidateId}`)
      .then(res => res.json())
      .then(data => {

        setCandidate(data);

        setStatus(data.status ?? "Not Called");

        // ensure placeholder works
        setNotes(data.notes?.trim() ?? "");

        setApplicationId(data.application_id);
        
        // If candidate was already called or already has notes, show the scheduling section immediately
        if (data.status === "Called" || (data.notes && data.notes.trim() !== "")) {
          setNotesSaved(true);
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

    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/recruitment/applications/${applicationId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          notes
        }),
      }
    );

    alert("Notes saved");
    setNotesSaved(true);

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
      alert("Failed to connect to server");
    }
    setSendingEmail(false);
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

                <iframe
                  src={`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/${candidate.cv_file_path}`}
                  className="w-full h-[650px] border border-gray-200 rounded-lg"
                />

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
                <p className="text-sm text-gray-700">
                  {candidate.ai_score ?? "-"}%
                </p>

              </div>

              {/* Status + Notes */}

              <div className="bg-white rounded-2xl border border-gray-200 p-6">

                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Status and Notes
                </h3>

                <p className="text-sm text-gray-500 mb-2">Status</p>

                <SelectBox value={status} onChange={setStatus} disabled={notesSaved}>
                  <option>Not Called</option>
                  <option>Called</option>
                </SelectBox>

                <p className="text-sm text-gray-500 mt-4 mb-2">
                  Call Notes
                </p>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={notesSaved}
                  placeholder="Write notes from the call or interview..."
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm h-28 text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 disabled:bg-gray-50 disabled:text-gray-500"
                />

                {!notesSaved && (
                  <button
                    onClick={saveNotes}
                    className="mt-4 w-full bg-orange-400 hover:bg-orange-500 text-white py-2.5 rounded-xl text-sm font-medium transition"
                  >
                    Save Notes
                  </button>
                )}

              </div>
              
              {/* Interview Scheduling Section */}
              {notesSaved && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Interview Scheduling
                  </h3>
                  
                  {(!panel || !panel.interview_link) ? (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 text-sm">
                      <p className="font-medium mb-1">Missing Interview Panel</p>
                      <p>To send an interview link, please set up an interview panel with a Cita link for this vacancy.</p>
                      <Link href={`/recruitment/${vacancyId}/edit`} className="text-orange-500 hover:underline mt-2 inline-block font-medium">
                        Edit Vacancy Panel
                      </Link>
                    </div>
                  ) : linkSent ? (
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 text-gray-800 font-medium mb-1">
                        <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
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
                      <p className="text-sm text-gray-500 mb-4">
                        Send interview scheduling link to the candidate.
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
                      
                      <Link
                        href={`/recruitment/${vacancyId}/candidates/${candidateId}/evaluate`}
                        className="block text-center text-xs text-gray-400 hover:text-gray-600 hover:underline mt-4"
                      >
                        Skip email & go to evaluation (Dev Mode)
                      </Link>
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