"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../../components/Sidebar";
import TopBar from "../../components/Topbar";
import { IconChevron } from "../../components/Icons";

type Vacancy = {
  id: number;
  title: string;
  department: string;
  status: "Active" | "Closed";
  applicants: number;
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

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [deptFilter, setDeptFilter] = useState("All Departments");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/recruitment/vacancies")
      .then((res) => res.json())
      .then((data) => setVacancies(data))
      .catch((err) => console.error("Failed to load vacancies:", err));
  }, []);

  const departments = Array.from(new Set(vacancies.map((v) => v.department)));

  const filtered = vacancies.filter((v) => {
    const statusOk = statusFilter === "All Status" || v.status === statusFilter;
    const deptOk = deptFilter === "All Departments" || v.department === deptFilter;
    return statusOk && deptOk;
  });

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar activePath="/recruitment" />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-8">
          {/* Page header + filters as one tight block */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-2xl font-bold text-gray-800">Vacancies</h2>
              <Link
                href="/recruitment/create"
                className="bg-orange-400 hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                + Add New Vacancy
              </Link>
            </div>

            <div className="flex gap-2">
              <FilterSelect value={statusFilter} onChange={setStatusFilter}>
                <option>All Status</option>
                <option>Active</option>
                <option>Closed</option>
              </FilterSelect>
              <FilterSelect value={deptFilter} onChange={setDeptFilter}>
                <option>All Departments</option>
                {departments.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </FilterSelect>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left   px-6 py-4 text-sm font-medium text-gray-500">Position</th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Department</th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Applicants</th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                      No vacancies found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((v) => (
                    <tr key={v.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-gray-800 text-sm">{v.title}</td>

                      <td className="px-6 py-4 text-gray-500 text-sm text-center">{v.department}</td>

                      <td className="px-6 py-4 text-center">
                        {v.status === "Active" ? (
                          <span className="bg-orange-400 text-white px-4 py-1.5 rounded-full text-xs font-medium">
                            Active
                          </span>
                        ) : (
                          <span className="bg-gray-200 text-gray-500 px-4 py-1.5 rounded-full text-xs font-medium">
                            Closed
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-gray-600 text-sm text-center">
                        {v.applicants ?? 0}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center justify-center gap-4">
                          <Link
                            href={`/recruitment/${v.id}`}
                            className="text-orange-500 hover:text-orange-600 font-medium transition-colors"
                          >
                            View
                          </Link>
                          {v.status === "Active" && (
                            <Link
                              href={`/recruitment/${v.id}/edit`}
                              className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              Edit
                            </Link>
                          )}
                        </div>
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