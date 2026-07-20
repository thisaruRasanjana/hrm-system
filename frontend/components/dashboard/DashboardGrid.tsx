"use client";

import { Responsive, WidthProvider } from "react-grid-layout";
import { useState, useEffect } from "react";
import { widgetRegistry } from "./widgetRegistry";
import { LayoutGrid, RotateCcw, Save, X, Check } from "lucide-react";
import { WIDGET_META } from "@/lib/permissions";
import { apiFetch } from "@/lib/api";

const ResponsiveGridLayout = WidthProvider(Responsive);

const defaultLayout = [
  { i: "time_tracking",    x: 0, y: 0, w: 4, h: 3 },
  { i: "leave_balance",    x: 4, y: 0, w: 4, h: 3 },
  { i: "notifications",    x: 8, y: 0, w: 4, h: 3 },
  { i: "weekly_hours",     x: 0, y: 3, w: 4, h: 3 },
  { i: "calendar",         x: 4, y: 3, w: 4, h: 3 },
  { i: "approval_summary", x: 8, y: 3, w: 4, h: 3 },
  { i: "announcements",    x: 0, y: 6, w: 4, h: 3 },
  { i: "upcoming_events",  x: 4, y: 6, w: 4, h: 3 },
];

interface Props {
  editMode: boolean;
  onSave: () => void;
  permissions: string[];
}

export default function DashboardGrid({ editMode, onSave, permissions }: Props) {

  // Determine which widgets the user is allowed to view based on permissions
  const allowedMeta = WIDGET_META.filter((w) => permissions.includes(w.viewPermission));

  // Special case: approval_summary shows if user has EITHER approval permission
  // (already covered via viewPermission for "view_approvals", add second check)
  const needsApproval =
    permissions.includes("widget.approval_summary.view_approvals") ||
    permissions.includes("widget.approval_summary.view_requests");

  const effectiveAllowed = needsApproval
    ? allowedMeta.find((w) => w.key === "approval_summary")
      ? allowedMeta
      : [...allowedMeta, WIDGET_META.find((w) => w.key === "approval_summary")!]
    : allowedMeta;

  const initialVisible = Object.fromEntries(
    effectiveAllowed.map((w) => [w.key, true])
  );

  const [layout, setLayout] = useState(defaultLayout);
  const [visible, setVisible] = useState<Record<string, boolean>>(initialVisible);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftVisible, setDraftVisible] = useState<Record<string, boolean>>(initialVisible);

  // Load the user's persisted layout on mount / when permissions resolve, so a
  // saved arrangement (and removed widgets) survive refresh AND re-login. The
  // backend returns the default arrangement when the user has never saved, so a
  // first-time dashboard still shows every allowed widget.
  useEffect(() => {
    let cancelled = false;
    const fresh = Object.fromEntries(effectiveAllowed.map((w) => [w.key, true]));
    const allowedKeys = new Set(effectiveAllowed.map((w) => w.key));

    (async () => {
      try {
        const res = await apiFetch("/dashboard/layout");
        if (!res.ok) throw new Error(`layout load failed (${res.status})`);
        const data = await res.json();
        const saved = Array.isArray(data?.widgets) ? data.widgets : [];
        // Keep only widgets the user may see AND the app can render.
        const usable = saved.filter((w: any) => allowedKeys.has(w.i) && widgetRegistry[w.i]);
        if (cancelled) return;
        if (usable.length > 0) {
          setLayout(usable.map((w: any) => ({ i: w.i, x: w.x, y: w.y, w: w.w, h: w.h })));
          const savedKeys = new Set(usable.map((w: any) => w.i));
          // A widget the user previously removed is absent from the saved set →
          // stays hidden; everything else the user is allowed to see stays on.
          const vis = Object.fromEntries(effectiveAllowed.map((w) => [w.key, savedKeys.has(w.key)]));
          setVisible(vis);
          setDraftVisible(vis);
          return;
        }
      } catch (e) {
        console.error(e);
      }
      if (!cancelled) {
        setVisible(fresh);
        setDraftVisible(fresh);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions.join(",")]);

  // Persist the current arrangement (only visible widgets) server-side, then
  // hand control back to the parent so it can leave edit mode.
  const handleSaveLayout = async () => {
    const widgetsToSave = layout.filter((item) => visible[item.i]);
    try {
      await apiFetch("/dashboard/layout", {
        method: "POST",
        body: JSON.stringify({ widgets: widgetsToSave }),
      });
    } catch (e) {
      console.error("Failed to save dashboard layout:", e);
    } finally {
      onSave();
    }
  };

  const openModal = () => {
    setDraftVisible({ ...visible });
    setModalOpen(true);
  };

  const applyChanges = () => {
    setVisible({ ...draftVisible });
    setLayout((prev) => {
      const map = Object.fromEntries(prev.map((item) => [item.i, item]));
      return effectiveAllowed
        .filter((w) => draftVisible[w.key])
        .map((w) => map[w.key] ?? defaultLayout.find((d) => d.i === w.key)!);
    });
    setModalOpen(false);
  };

  const resetLayout = () => {
    setLayout(defaultLayout);
    setVisible({ ...initialVisible });
  };

  const activeLayout = layout.filter((item) => visible[item.i]);

  return (
    <>
      {/* Edit mode bar */}
      {editMode && (
        <div className="flex items-center justify-between mb-2">
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <span className="w-2 h-2 rounded-full bg-[#F2924E] inline-block" />
            Edit Mode — drag & resize widgets
          </p>
          <div className="flex items-center gap-3">
            <button onClick={openModal} className="flex items-center gap-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-1.5 rounded-lg transition">
              <LayoutGrid size={14} /> Edit Widgets
            </button>
            <button onClick={resetLayout} className="flex items-center gap-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-1.5 rounded-lg transition">
              <RotateCcw size={14} /> Reset
            </button>
            <button onClick={handleSaveLayout} className="flex items-center gap-1.5 bg-[#F2924E] hover:bg-orange-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition">
              <Save size={14} /> Save Layout
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
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
              id={`widget-${item.i}`}
              className={`flex flex-col h-full ${editMode ? "rounded-2xl border-2 border-[#F2924E] relative overflow-hidden" : ""}`}
            >
              {editMode && (
                <div className="absolute top-2 left-2 z-10 grid grid-cols-2 gap-[3px] opacity-60 cursor-grab">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span key={i} className="w-1 h-1 rounded-full bg-[#F2924E]" />
                  ))}
                </div>
              )}
              <div
                className="flex-1 min-h-0"
                style={editMode ? { pointerEvents: "none", userSelect: "none" } : {}}
              >
                {/* Pass permissions prop to every widget */}
                <Widget permissions={permissions} />
              </div>
            </div>
          );
        })}
      </ResponsiveGridLayout>

      {/* Edit Widgets Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setModalOpen(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-[560px] p-8 z-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Widgets</h2>
                <p className="text-sm text-gray-500 mt-0.5">Choose widgets to show on your dashboard</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-0 mt-5">
              {effectiveAllowed.map((w) => {
                const on = draftVisible[w.key];
                return (
                  <button
                    key={w.key}
                    onClick={() => setDraftVisible((prev) => ({ ...prev, [w.key]: !prev[w.key] }))}
                    className="flex items-center justify-between py-4 border-b border-gray-100 text-left hover:bg-gray-50 px-2 rounded-lg transition"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{w.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{w.description}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 border-2 transition ${on ? "bg-[#F2924E] border-[#F2924E]" : "bg-white border-gray-300"}`}>
                      {on && <Check size={13} className="text-white" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModalOpen(false)} className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2">Cancel</button>
              <button onClick={applyChanges} className="bg-[#F2924E] hover:bg-orange-500 text-white text-sm font-medium px-6 py-2 rounded-lg transition">
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}