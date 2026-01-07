"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Vacancy = {
  id: number;
  title: string;
  department: string;
};

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/recruitment/vacancies")
      .then((res) => res.json())
      .then((data) => setVacancies(data));
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#F3F3F3] border-r border-gray-200 px-6 py-8">
        <h1 className="text-2xl font-bold mb-10 tracking-wide">
          HRSM
        </h1>

        <p className="text-xs text-gray-400 tracking-widest mb-6">
          MAIN MENU
        </p>

        <nav className="space-y-6 text-gray-500 text-base">
          <div className="cursor-pointer">Dashboard</div>

          <div className="text-orange-500 font-semibold">
            Recruitment
          </div>

          <div className="cursor-pointer">Document</div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-10">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-3xl font-semibold text-gray-800">
            Vacancies
          </h2>

          <Link
            href="/recruitment/create"
            className="bg-orange-400 hover:bg-orange-500 text-white px-6 py-3 rounded-xl text-sm font-medium"
          >
            + Add New Vacancy
          </Link>
        </div>

        {/* FILTERS */}
        <div className="flex gap-4 mb-6">
          <select className="border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-600 bg-white">
            <option>All Status</option>
          </select>

          <select className="border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-600 bg-white">
            <option>All Departments</option>
          </select>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">
                  Position
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">
                  Department
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">
                  Status
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">
                  Applicants
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {vacancies.map((v) => (
                <tr
                  key={v.id}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-6 py-5 text-gray-800 text-sm">
                    {v.title}
                  </td>

                  <td className="px-6 py-5 text-gray-800 text-sm">
                    {v.department}
                  </td>

                  <td className="px-6 py-5">
                    <span className="bg-orange-100 text-orange-600 px-4 py-1.5 rounded-full text-xs font-medium">
                      Active
                    </span>
                  </td>

                  <td className="px-6 py-5 text-gray-500 text-sm">
                    24
                  </td>

                  <td className="px-6 py-5 text-sm">
                    <button className="text-orange-500 font-medium mr-4">
                      View
                    </button>
                    <button className="text-gray-400 hover:text-gray-600">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}