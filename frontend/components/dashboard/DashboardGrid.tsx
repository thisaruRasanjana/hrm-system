"use client";

import { Responsive, WidthProvider } from "react-grid-layout";
import { useState } from "react";
import { widgetRegistry } from "./widgetRegistry";
import { LayoutGrid, RotateCcw, Save, X, Check } from "lucide-react";

const ResponsiveGridLayout = WidthProvider(Responsive);

/* ─── Metadata for the Edit Widgets modal ─── */
const widgetMeta: { key: string; label: string; description: string }[] = [
  { key: "time_tracking",   label: "Time Tracking",           description: "Track your work hours"     },
  { key: "leave_balance",   label: "Leave Balance",           description: "View your leave status"    },
  { key: "notifications",   label: "Notifications",           description: "Recent notifications"      },
  { key: "weekly_hours",    label: "Weekly Hours",            description: "Weekly hours chart"        },
  { key: "availability",    label: "Team Availability",       description: "Team status overview"      },
  { key: "calendar",        label: "Calendar",                description: "Monthly calendar view"     },
  { key: "approval_summary",label: "Approval & Req. Summary", description: "Pending approvals"        },
  { key: "announcements",   label: "Announcements",           description: "Company announcements"    },
  { key: "upcoming_events", label: "Upcoming Events",         description: "Schedule at a glance"     },
];

const defaultLayout = [
  { i: "time_tracking",    x: 0, y: 0, w: 4, h: 3 },
  { i: "leave_balance",    x: 4, y: 0, w: 4, h: 3 },
  { i: "notifications",    x: 8, y: 0, w: 4, h: 3 },
  { i: "weekly_hours",     x: 0, y: 3, w: 4, h: 3 },
  { i: "availability",     x: 4, y: 3, w: 4, h: 3 },
  { i: "calendar",         x: 8, y: 3, w: 4, h: 3 },
  { i: "approval_summary", x: 0, y: 6, w: 4, h: 3 },
  { i: "announcements",    x: 4, y: 6, w: 4, h: 3 },
  { i: "upcoming_events",  x: 8, y: 6, w: 4, h: 3 },
];

const defaultVisible = Object.fromEntries(widgetMeta.map((w) => [w.key, true]));

interface Props {
  editMode: boolean;
  onSave: () => void;
}

export default function DashboardGrid({ editMode, onSave }: Props) {

  const [layout, setLayout] = useState(defaultLayout);
  const [visible, setVisible] = useState<Record<string, boolean>>(defaultVisible);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftVisible, setDraftVisible] = useState<Record<string, boolean>>(defaultVisible);

  /* open modal — copy current state into draft */
  const openModal = () => {
    setDraftVisible({ ...visible });
    setModalOpen(true);
  };

  /* Apply Changes — keeps current positions for visible items,
     restores default position for items being re-added */
  const applyChanges = () => {
    const newVisible = { ...draftVisible };
    setVisible(newVisible);
    setLayout((prev) => {
      const currentMap = Object.fromEntries(prev.map((item) => [item.i, item]));
      return widgetMeta
        .filter((w) => newVisible[w.key])
        .map((w) => currentMap[w.key] ?? defaultLayout.find((d) => d.i === w.key)!);
    });
    setModalOpen(false);
  };

  /* Reset layout & visibility */
  const resetLayout = () => {
    setLayout(defaultLayout);
    setVisible(defaultVisible);
  };

  const activeLayout = layout.filter((item) => visible[item.i]);

  return (
    <>
      {/* ── Edit Mode Bar ── */}
      {editMode && (
        <div className="flex items-center justify-between mb-2">
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <span className="w-2 h-2 rounded-full bg-[#F2924E] inline-block" />
            Edit Mode · Drag and resize widgets
          </p>

          <div className="flex items-center gap-3">
            {/* Edit Widgets */}
            <button
              onClick={openModal}
              className="flex items-center gap-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-1.5 rounded-lg transition"
            >
              <LayoutGrid size={14} /> Edit Widgets
            </button>

            {/* Reset */}
            <button
              onClick={resetLayout}
              className="flex items-center gap-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-1.5 rounded-lg transition"
            >
              <RotateCcw size={14} /> Reset
            </button>

            {/* Save Layout */}
            <button
              onClick={onSave}
              className="flex items-center gap-1.5 bg-[#F2924E] hover:bg-orange-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition"
            >
              <Save size={14} /> Save Layout
            </button>
          </div>
        </div>
      )}

      {/* ── Grid ── */}
      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: activeLayout }}
        breakpoints={{ lg: 1200 }}
        cols={{ lg: 12 }}
        rowHeight={120}
        margin={[16, 16]}
        isDraggable={editMode}
        isResizable={false}
        onLayoutChange={(newLayout) => setLayout(newLayout)}
      >
        {activeLayout.map((item) => {
          const Widget = widgetRegistry[item.i];
          return (
            <div
              key={item.i}
              className={`flex flex-col h-full ${editMode ? "rounded-2xl border-2 border-[#F2924E] relative overflow-hidden" : ""}`}
            >
              {/* Drag handle dots (edit mode only) */}
              {editMode && (
                <div className="absolute top-2 left-2 z-10 grid grid-cols-2 gap-[3px] opacity-60 cursor-grab">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span key={i} className="w-1 h-1 rounded-full bg-[#F2924E]" />
                  ))}
                </div>
              )}
              {/* Block widget click-navigation in edit mode so drag events aren't swallowed */}
              <div
                className="flex-1 min-h-0"
                style={editMode ? { pointerEvents: "none", userSelect: "none" } : {}}
              >
                <Widget />
              </div>
            </div>
          );
        })}
      </ResponsiveGridLayout>

      {/* ── Edit Widgets Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />

          {/* Modal card */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-[560px] p-8 z-10">
            {/* Header */}
            <div className="flex items-start justify-between mb-1">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Widgets</h2>
                <p className="text-sm text-gray-500 mt-0.5">Choose widgets to add to your dashboard</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Widget list — 2 columns */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-0 mt-5">
              {widgetMeta.map((w) => {
                const on = draftVisible[w.key];
                return (
                  <button
                    key={w.key}
                    onClick={() =>
                      setDraftVisible((prev) => ({ ...prev, [w.key]: !prev[w.key] }))
                    }
                    className="flex items-center justify-between py-4 border-b border-gray-100 text-left hover:bg-gray-50 px-2 rounded-lg transition"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{w.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{w.description}</p>
                    </div>

                    {/* Toggle checkbox */}
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 border-2 transition ${
                        on
                          ? "bg-[#F2924E] border-[#F2924E]"
                          : "bg-white border-gray-300"
                      }`}
                    >
                      {on && <Check size={13} className="text-white" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setModalOpen(false)}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 transition"
              >
                Cancel
              </button>
              <button
                onClick={applyChanges}
                className="bg-[#F2924E] hover:bg-orange-500 text-white text-sm font-medium px-6 py-2 rounded-lg transition"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}