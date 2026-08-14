"use client";

/**
 * App-wide replacement for the native window.alert / confirm / prompt dialogs.
 *
 * Renders a single centred modal (via ModalPortal, so it escapes any
 * overflow:hidden widget tile) and exposes a promise-based API, which keeps
 * call sites almost identical to the native ones they replace:
 *
 *   const { showAlert, showConfirm, showPrompt } = useDialog();
 *
 *   await showAlert("Failed to download report.");
 *   if (!(await showConfirm("Remove this holiday?"))) return;
 *   const reason = await showPrompt("Reason for cancellation:", { required: true });
 *
 * showConfirm resolves false and showPrompt resolves null when dismissed, so
 * the existing `if (!confirm(...)) return;` guards keep working unchanged.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import ModalPortal from "@/components/ModalPortal";

export type DialogTone = "danger" | "warning" | "info" | "success";

export type DialogOptions = {
  title?: string;
  tone?: DialogTone;
  confirmText?: string;
  cancelText?: string;
  /** prompt only */
  placeholder?: string;
  /** prompt only */
  defaultValue?: string;
  /** prompt only — blocks submit while the field is empty */
  required?: boolean;
};

type DialogKind = "alert" | "confirm" | "prompt";

type DialogState = DialogOptions & {
  kind: DialogKind;
  message: string;
};

type DialogApi = {
  showAlert: (message: string, options?: DialogOptions) => Promise<void>;
  showConfirm: (message: string, options?: DialogOptions) => Promise<boolean>;
  showPrompt: (
    message: string,
    options?: DialogOptions
  ) => Promise<string | null>;
};

const DialogContext = createContext<DialogApi | null>(null);

const TONE_STYLES: Record<
  DialogTone,
  { tile: string; button: string; Icon: typeof AlertTriangle }
> = {
  danger: {
    tile: "bg-red-50/50 text-red-600 border-red-100",
    button: "bg-red-600 hover:bg-red-700",
    Icon: AlertTriangle,
  },
  warning: {
    tile: "bg-orange-50/50 text-orange-600 border-orange-100",
    button: "bg-[#F2924E] hover:bg-[#e07d3a]",
    Icon: AlertTriangle,
  },
  info: {
    tile: "bg-blue-50/50 text-blue-600 border-blue-100",
    button: "bg-[#F2924E] hover:bg-[#e07d3a]",
    Icon: Info,
  },
  success: {
    tile: "bg-emerald-50/50 text-emerald-600 border-emerald-100",
    button: "bg-emerald-600 hover:bg-emerald-700",
    Icon: CheckCircle2,
  },
};

const DEFAULT_TITLE: Record<DialogTone, string> = {
  danger: "Something went wrong",
  warning: "Heads up",
  info: "Notice",
  success: "Success",
};

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [value, setValue] = useState("");
  // Resolver for the promise handed back to the caller. Held in a ref so that
  // re-renders never lose it.
  const resolveRef = useRef<((result: unknown) => void) | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const settle = useCallback((result: unknown) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setDialog(null);
    setValue("");
  }, []);

  const open = useCallback(
    (state: DialogState, dismissedResult: unknown) => {
      // A dialog already on screen is dismissed rather than dropped, so its
      // caller's promise can never hang.
      resolveRef.current?.(dismissedResult);
      setValue(state.defaultValue ?? "");
      setDialog(state);
      return new Promise((resolve) => {
        resolveRef.current = resolve as (result: unknown) => void;
      });
    },
    []
  );

  const showAlert = useCallback(
    (message: string, options: DialogOptions = {}) =>
      open(
        { kind: "alert", message, tone: "danger", ...options },
        undefined
      ) as Promise<void>,
    [open]
  );

  const showConfirm = useCallback(
    (message: string, options: DialogOptions = {}) =>
      open(
        { kind: "confirm", message, tone: "danger", ...options },
        false
      ) as Promise<boolean>,
    [open]
  );

  const showPrompt = useCallback(
    (message: string, options: DialogOptions = {}) =>
      open(
        { kind: "prompt", message, tone: "info", ...options },
        null
      ) as Promise<string | null>,
    [open]
  );

  const dismiss = useCallback(() => {
    if (!dialog) return;
    settle(
      dialog.kind === "alert"
        ? undefined
        : dialog.kind === "confirm"
        ? false
        : null
    );
  }, [dialog, settle]);

  const accept = useCallback(() => {
    if (!dialog) return;
    if (dialog.kind === "prompt") {
      if (dialog.required && !value.trim()) return;
      settle(value);
      return;
    }
    settle(dialog.kind === "confirm" ? true : undefined);
  }, [dialog, settle, value]);

  // Escape dismisses, mirroring the native dialogs.
  useEffect(() => {
    if (!dialog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialog, dismiss]);

  // Focus the text field as soon as a prompt appears.
  useEffect(() => {
    if (dialog?.kind === "prompt") inputRef.current?.focus();
  }, [dialog]);

  const tone = dialog?.tone ?? "danger";
  const { tile, button, Icon } = TONE_STYLES[tone];
  const submitDisabled =
    dialog?.kind === "prompt" && dialog.required && !value.trim();

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
      {children}

      <ModalPortal open={dialog !== null} onClose={dismiss}>
        {dialog && (
          <form
            role="dialog"
            aria-modal="true"
            aria-label={dialog.title ?? DEFAULT_TITLE[tone]}
            onSubmit={(e) => {
              e.preventDefault();
              accept();
            }}
            className="relative bg-white w-[calc(100vw-2rem)] max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          >
            <div className="p-6 pb-0 flex flex-col items-center text-center">
              <div
                className={`${tile} w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border`}
              >
                <Icon size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {dialog.title ?? DEFAULT_TITLE[tone]}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed px-4 whitespace-pre-line">
                {dialog.message}
              </p>

              {dialog.kind === "prompt" && (
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={dialog.placeholder}
                  className="mt-4 w-full px-4 py-3 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl outline-none transition focus:border-[#F2924E] focus:ring-2 focus:ring-[#F2924E]/20"
                />
              )}
            </div>

            <div className="p-6 flex flex-col sm:flex-row gap-3">
              {dialog.kind !== "alert" && (
                <button
                  type="button"
                  onClick={dismiss}
                  className="flex-1 px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-all duration-300 shadow-sm"
                >
                  {dialog.cancelText ?? "Cancel"}
                </button>
              )}
              <button
                type="submit"
                autoFocus={dialog.kind !== "prompt"}
                disabled={submitDisabled}
                className={`flex-1 px-4 py-3 text-sm font-bold text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${button}`}
              >
                {dialog.confirmText ??
                  (dialog.kind === "alert" ? "OK" : "Confirm")}
              </button>
            </div>

            <button
              type="button"
              onClick={dismiss}
              aria-label="Close"
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </form>
        )}
      </ModalPortal>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within a DialogProvider");
  return ctx;
}
