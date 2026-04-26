"use client";

import { X, AlertTriangle } from "lucide-react";

type Props = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  type?: "danger" | "warning" | "info";
};

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  type = "danger",
}: Props) {
  if (!isOpen) return null;

  const colorClass = 
    type === "danger" ? "bg-red-500" : 
    type === "warning" ? "bg-orange-500" : 
    "bg-blue-500";

  const lightColorClass = 
    type === "danger" ? "bg-red-50/50 text-red-600 border-red-100" : 
    type === "warning" ? "bg-orange-50/50 text-orange-600 border-orange-100" : 
    "bg-blue-50/50 text-blue-600 border-blue-100";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onCancel}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300 overflow-hidden">
        
        {/* Header/Icon Area */}
        <div className="p-6 pb-0 flex flex-col items-center text-center">
          <div className={`${lightColorClass} w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border`}>
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-500 text-sm leading-relaxed px-4">
            {message}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-all duration-300 shadow-sm disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-3 text-sm font-bold text-white rounded-xl transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 ${
              type === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-[#F2924E] hover:bg-[#e07d3a]"
            }`}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              confirmText
            )}
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
