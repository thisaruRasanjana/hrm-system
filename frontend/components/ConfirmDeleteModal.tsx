import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface Props {
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title?: string;
  message?: string;
}

export default function ConfirmDeleteModal({
  onClose,
  onConfirm,
  title = "Delete Request",
  message = "Are you sure you want to cancel and delete this pending request? This action cannot be undone."
}: Props) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-[400px] rounded-2xl bg-white shadow-xl p-6 flex flex-col my-auto border border-gray-100">
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="text-red-600" size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          </div>
          <button
            type="button"
            onClick={() => !isDeleting && onClose()}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
          >
            <X size={22} />
          </button>
        </div>

        <p className="text-slate-600 text-sm mb-6 mt-2">
          {message}
        </p>

        <div className="flex flex-row justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-md transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors shadow-sm disabled:opacity-70"
          >
            {isDeleting ? (
              <><Loader2 size={18} className="animate-spin" /> Deleting</>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
