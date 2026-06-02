/**
 * Skeleton — reusable shimmer loading primitives for the HRM system.
 * Uses a pure CSS shimmer so there's zero dependency overhead.
 *
 * Usage:
 *   <Skeleton className="h-4 w-32 rounded" />           // single bar
 *   <SkeletonText lines={3} />                           // block of text lines
 *   <SkeletonAvatar size="md" />                         // circular avatar
 *   <SkeletonCard />                                     // generic card block
 *   <SkeletonTableRows rows={6} cols={5} />              // table body rows
 *   <SkeletonWidgetGrid />                               // dashboard widget grid
 */

import React from "react";

// ---------------------------------------------------------------------------
// Base — every skeleton element shares this shimmer animation
// ---------------------------------------------------------------------------

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer rounded ${className}`}
      style={style}
    />
  );
}

// ---------------------------------------------------------------------------
// Text block  (multiple lines, last line shorter for realism)
// ---------------------------------------------------------------------------

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className = "" }: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3.5 rounded"
          style={{ width: i === lines - 1 ? "65%" : "100%" }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar / icon circle
// ---------------------------------------------------------------------------

type AvatarSize = "sm" | "md" | "lg";
const avatarSizes: Record<AvatarSize, string> = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-14 h-14",
};

interface SkeletonAvatarProps {
  size?: AvatarSize;
  className?: string;
}

export function SkeletonAvatar({ size = "md", className = "" }: SkeletonAvatarProps) {
  return (
    <Skeleton className={`${avatarSizes[size]} rounded-full flex-shrink-0 ${className}`} />
  );
}

// ---------------------------------------------------------------------------
// Generic card
// ---------------------------------------------------------------------------

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-6 shadow-sm ${className}`} aria-hidden="true">
      <div className="flex items-start gap-4 mb-4">
        <SkeletonAvatar size="md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table rows
// ---------------------------------------------------------------------------

interface SkeletonTableRowsProps {
  rows?: number;
  cols?: number;
}

export function SkeletonTableRows({ rows = 6, cols = 5 }: SkeletonTableRowsProps) {
  // Column width proportions for a natural look
  const colWidths = ["w-20", "w-32", "w-24", "w-28", "w-16"];

  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri} aria-hidden="true">
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} className="px-6 py-5">
              <Skeleton className={`h-3.5 ${colWidths[ci % colWidths.length]} rounded`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Stat / KPI card  (number + label)
// ---------------------------------------------------------------------------

export function SkeletonStatCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-5 shadow-sm ${className}`} aria-hidden="true">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-16 mb-1" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard widget grid skeleton  (mirrors the real grid layout)
// ---------------------------------------------------------------------------

export function SkeletonWidgetGrid() {
  const placeholders = [
    "col-span-4 row-span-3",
    "col-span-4 row-span-3",
    "col-span-4 row-span-3",
    "col-span-4 row-span-3",
    "col-span-4 row-span-3",
    "col-span-4 row-span-3",
    "col-span-4 row-span-3",
    "col-span-4 row-span-3",
  ];

  return (
    <div
      className="grid grid-cols-12 gap-4"
      style={{ gridAutoRows: "120px" }}
      aria-hidden="true"
    >
      {placeholders.map((span, i) => (
        <div key={i} className={`${span} bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3`}>
          {/* Widget header */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
          {/* Widget body */}
          <Skeleton className="flex-1 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile page skeleton
// ---------------------------------------------------------------------------

export function SkeletonProfile() {
  return (
    <div className="space-y-6" aria-hidden="true">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm flex items-center gap-6">
        <SkeletonAvatar size="lg" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      {/* Sections */}
      {[1, 2, 3].map((n) => (
        <div key={n} className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
          <Skeleton className="h-4 w-36 mb-6" />
          <div className="grid grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
