import React from "react";
import { AlertTriangle } from "lucide-react";
import { ViolationRecord } from "@/app/reports/types";

interface Props {
  records: ViolationRecord[];
}

export default function ViolationsPanel({ records }: Props) {
  const severityClasses = (severity: ViolationRecord["severity"]) => {
    if (severity === "HIGH SEVERITY") {
      return {
        card: "border-red-200 bg-red-50",
        badge: "bg-red-500 text-white",
      };
    }

    return {
      card: "border-orange-200 bg-orange-50",
      badge: "bg-orange-400 text-white",
    };
  };

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 md:p-6">
      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 text-red-500" />
          <div>
            <h4 className="text-sm font-semibold text-red-600">
              Attendance Violation Summary
            </h4>
            <p className="mt-1 text-xs text-red-500">
              This employee has {records.length} documented violations, including
              high-severity incidents. This documentation can be used for
              disciplinary actions.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {records.map((record, index) => {
          const styles = severityClasses(record.severity);

          return (
            <div
              key={`${record.title}-${index}`}
              className={`rounded-xl border p-4 ${styles.card}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="mt-0.5 text-orange-500" />
                  <div>
                    <h5 className="text-sm font-semibold text-gray-800">
                      {record.title}
                    </h5>
                    <p className="mt-1 text-xs text-gray-500">{record.date}</p>
                    <p className="mt-2 text-sm text-gray-700">
                      {record.description}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex rounded-full px-3 py-1 text-[10px] font-semibold ${styles.badge}`}
                >
                  {record.severity}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}