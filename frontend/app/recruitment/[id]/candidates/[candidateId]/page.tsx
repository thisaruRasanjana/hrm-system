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
        className="appearance-none w-full bg-white border border-gray-200 rounded-lg pl-4 pr-9 py-2.5 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
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

  useEffect(() => {

    fetch(`http://127.0.0.1:8000/recruitment/candidates/${candidateId}`)
      .then(res => res.json())
      .then(data => {

        setCandidate(data);

        setStatus(data.status ?? "Not Called");

        // ensure placeholder works
        setNotes(data.notes?.trim() ?? "");

        setApplicationId(data.application_id);

        setLoading(false);

      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });

  }, [candidateId]);

  const saveNotes = async () => {

    if (!applicationId) return;

    await fetch(
      `http://127.0.0.1:8000/recruitment/applications/${applicationId}`,
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
                  src={`http://127.0.0.1:8000/${candidate.cv_file_path}`}
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

                <SelectBox value={status} onChange={setStatus}>
                  <option>Not Called</option>
                  <option>Called</option>
                </SelectBox>

                <p className="text-sm text-gray-500 mt-4 mb-2">
                  Call Notes
                </p>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Write notes from the call or interview..."
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm h-28 text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                />

                <button
                  onClick={saveNotes}
                  className="mt-4 w-full bg-orange-400 hover:bg-orange-500 text-white py-2.5 rounded-xl text-sm font-medium transition"
                >
                  Save Notes
                </button>

              </div>

            </div>

          </div>

        </main>

      </div>

    </div>
  );
}