"use client";

import { useState, useCallback } from "react";

/**
 * Returns { closing, triggerClose }
 * Call triggerClose() instead of onClose() directly.
 * It plays the exit animation for 200 ms then calls the real onClose.
 */
export function useCloseAnimation(onClose: () => void) {
  const [closing, setClosing] = useState(false);

  const triggerClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  }, [onClose]);

  return { closing, triggerClose };
}
