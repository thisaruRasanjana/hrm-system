"use client";

/**
 * Portal-based modal overlay.
 *
 * Renders children into document.body so the modal escapes any parent
 * overflow:hidden or stacking context (e.g. react-grid-layout widget tiles).
 *
 * Usage:
 *   <ModalPortal open={open} onClose={() => setOpen(false)}>
 *     <div className="bg-white rounded-2xl p-6">...</div>
 *   </ModalPortal>
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function ModalPortal({ open, onClose, children }: Props) {
  const ref = useRef<Element | null>(null);

  // Attach to body once on client (avoids SSR mismatch)
  useEffect(() => {
    ref.current = document.body;
  }, []);

  if (!open || !ref.current) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      {/* Content — clicks don't bubble to the backdrop */}
      <div
        className="relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    ref.current
  );
}
