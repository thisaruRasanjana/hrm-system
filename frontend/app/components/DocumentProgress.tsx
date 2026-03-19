"use client";

interface Props {
  completed: number;
  total: number;
  label?: string;
}

export default function DocumentProgress({ completed, total, label }: Props) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const remaining = total - completed;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h3 className="font-semibold mb-2">{label ?? "Document Completion"}</h3>
      <p className="text-sm text-gray-500 mb-3">
        Mandatory Documents:{" "}
        <span className="font-medium">
          {completed} of {total} completed
        </span>
      </p>

      <div className="w-full bg-gray-200 h-2 rounded-full">
        <div
          className="bg-[#F2924E] h-2 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <p className="text-xs text-gray-400 mt-2">
        {remaining} document{remaining !== 1 ? "s" : ""} remaining
      </p>
    </div>
  );
}
