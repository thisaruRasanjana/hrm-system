import React from "react";
import { SummaryCardItem } from "@/app/reports/types";

interface Props {
  cards: SummaryCardItem[];
}

export default function ReportSummaryCards({ cards }: Props) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-[#FFF3E6] border border-[#F5C28B] rounded-xl p-5"
        >
          <p className="text-sm text-gray-600 mb-1">{card.label}</p>
          <h2 className="text-2xl font-bold text-gray-800">{card.value}</h2>
        </div>
      ))}
    </div>
  );
}