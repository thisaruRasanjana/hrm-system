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
      {/* Sidebar */}
      <aside className="w-64 bg-gray-50 border-r px-6 py-4">
        <h1 className="text-2xl font-bold mb-8">HRSM</h1>

        <nav className="space-y-4 text-gray-500">
          <div>Dashboard</div>
          <div className="text-orange-500 font-medium">Recruitment</div>
          <div>Document</div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Vacancies</h2>

          <Link
            href="/recruitment/create"
            className="bg-orange-400 hover:bg-orange-500 text-white px-5 py-2 rounded-lg"
          >
            + Add New Vacancy
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <select className="border rounded px-3 py-2">
            <option>All Status</option>
          </select>

          <select className="border rounded px-3 py-2">
            <option>All Departments</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3">Position</th>
                <th className="text-left px-4 py-3">Department</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Applicants</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {vacancies.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="px-4 py-4">{v.title}</td>
                  <td className="px-4 py-4">{v.department}</td>

                  <td className="px-4 py-4">
                    <span className="bg-orange-400 text-white px-3 py-1 rounded-full text-sm">
                      Active
                    </span>
                  </td>

                  <td className="px-4 py-4">24</td>

                  <td className="px-4 py-4 space-x-3 text-orange-500">
                    <button>View</button>
                    <button>Edit</button>
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