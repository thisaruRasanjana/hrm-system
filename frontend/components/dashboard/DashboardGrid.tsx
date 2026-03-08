"use client";

import { Responsive, WidthProvider } from "react-grid-layout";
import { useState } from "react";
import { widgetRegistry } from "./widgetRegistry";

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function DashboardGrid({ editMode }: { editMode: boolean }) {

  const [layout, setLayout] = useState([
    { i: "time_tracking", x: 0, y: 0, w: 4, h: 2 },
    { i: "leave_balance", x: 4, y: 0, w: 4, h: 2 },
    { i: "notifications", x: 8, y: 0, w: 4, h: 2 },
    { i: "weekly_hours", x: 0, y: 2, w: 6, h: 2 },
    { i: "availability", x: 6, y: 2, w: 3, h: 2 },
    { i: "calendar", x: 9, y: 2, w: 3, h: 2 },
  ]);

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={{ lg: layout }}
      breakpoints={{ lg: 1200 }}
      cols={{ lg: 12 }}
      rowHeight={120}
      isDraggable={editMode}
      isResizable={editMode}
      onLayoutChange={(newLayout) => setLayout(newLayout)}
    >
      {layout.map((item) => {
        const Widget = widgetRegistry[item.i as keyof typeof widgetRegistry];

        return (
          <div key={item.i}>
            <Widget />
          </div>
        );
      })}
    </ResponsiveGridLayout>
  );
}