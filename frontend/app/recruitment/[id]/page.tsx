"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";
import { IconChevron } from "@/components/Icons";

type Vacancy = {
  id: number;
  title: string;
};

type Candidate = {
  id: number;
  full_name: string;
  phone: string;
  status: string;
  ai_score?: number | null;
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

export default function VacancyDetailPage() {
  const params = useParams();
  const vacancyId = params.id as string;

  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");

  useEffect(() => {
    if (!vacancyId) return;

    fetch(`http://127.0.0.1:8000/recruitment/vacancies/${vacancyId}`)
      .then((res) => res.json())
      .then((data) => setVacancy(data))
      .catch(console.error);

    fetch(
      `http://127.0.0.1:8000/recruitment/vacancies/${vacancyId}/candidates`
    )
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCandidates(data);
        else setCandidates([]);
      })
      .catch(console.error);
  }, [vacancyId]);

  const filtered = candidates.filter((c) => {
    const matchesSearch =
      search === "" ||
      c.full_name.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "All Status" || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar activePath="/recruitment" />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-8">

          {/* Back Button */}
          <Link
            href="/recruitment"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
          >
            ← Back to Vacancies
          </Link>

          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">
              Candidates – {vacancy?.title ?? ""}
            </h2>

            <Link
              href={`/recruitment/${vacancyId}/upload`}
              className="bg-orange-400 hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              + Add CV
            </Link>
          </div>

          {/* Filters */}
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
              <option>Not Called</option>
              <option>Called</option>
            </FilterSelect>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">
                    Name
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">
                    Phone
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">
                    AI Score
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">
                    Status
                  </th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-12 text-gray-400 text-sm"
                    >
                      No candidates found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-gray-800 text-sm">
                        {c.full_name}
                      </td>

                      <td className="px-6 py-4 text-gray-600 text-sm text-center">
                        {c.phone}
                      </td>

                      <td className="px-6 py-4 text-gray-600 text-sm text-center">
                        {c.ai_score ?? "-"}%
                      </td>

                      <td className="px-6 py-4 text-center">
                        {c.status === "Called" ? (
                          <span className="bg-orange-400 text-white px-4 py-1.5 rounded-full text-xs font-medium">
                            Called
                          </span>
                        ) : (
                          <span className="bg-gray-200 text-gray-500 px-4 py-1.5 rounded-full text-xs font-medium">
                            Not Called
                          </span>
                        )}
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
                  ))
                )}
              </tbody>
            </table>
          </div>

        </main>
      </div>
    </div>
  );
}