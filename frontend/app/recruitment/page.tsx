"use client";

import { title } from "process";
import { useEffect, useState } from "react";

type Vacancy = {
  id: number;
  title: string;
  department: string;
  experience_level?: string;
  description?: string;
};

export default function RecruitmentPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [form, setForm] = useState({
    title: "",
    department: "",
    experience_level: "",
    description: "",
  });

  useEffect(() => {
    fetch("http://127.0.0.1:8000/recruitment/vacancies")
      .then((res) => res.json())
      .then((data) => setVacancies(data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await fetch("http://127.0.0.1:8000/recruitment/vacancies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      })

      const res = await fetch("http://127.0.0.1:8000/recruitment/vacancies");
      const data = await res.json();
      setVacancies(data);

      setForm({
        title: "",
        department: "",
        experience_level: "",
        description: "",
      });
  };


  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Recruitment</h1>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Job Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
        <br />

        <input
          placeholder="Department"
          value={form.department}
          onChange={(e) => setForm({ ...form, department: e.target.value })}
          required
        />
        <br />

        <input
          placeholder="Experience Level"
          value={form.experience_level}
          onChange={(e) =>
            setForm({ ...form, experience_level: e.target.value })
          }
        />
        <br />

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) =>
            setForm({ ...form, description: e.target.value })
          }
        />
        <br />

        <button type="submit">Create Vacancy</button>
      </form>

      <hr />

      <h2>Vacancies</h2>

      <ul>
        {vacancies.map((v) => (
          <li key={v.id}>
            <strong>{v.title}</strong> – {v.department}
            {v.experience_level && ` (${v.experience_level})`}
          </li>
        ))}
      </ul>
    </div>
  );
}