"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { IconTrash } from "@/components/Icons";
import { api } from "@/lib/api";

export type DeletableEmployee = {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  department?: string;
  designation?: string;
  status?: string;
};

type Props = {
  employee: DeletableEmployee;
  onClose: () => void;
  onDeleted: () => void;
};

/**
 * Confirmation popup for removing an employee — replaces the old full-page
 * delete screen. Deletes via the API and notifies the parent to refresh.
 *
 * Deleting hides the employee everywhere: their profile, documents and
 * records become inaccessible across the system. For employees who have
 * left the company, marking them Inactive is the safer option — it keeps
 * their details viewable in Employee Management and their documents
 * browsable under Documents → Employee Documents.
 */
export default function DeleteEmployeeModal({ employee, onClose, onDeleted }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDeactivate = employee.status !== "inactive";

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await api.delete(`/employees/${employee.id}`);
      onDeleted();
    } catch (err: any) {
      setError(err?.message || "Failed to delete employee.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeactivate = async () => {
    setIsDeactivating(true);
    setError(null);
    try {
      await api.put(`/employees/${employee.id}`, { status: "inactive" });
      onDeleted();
    } catch (err: any) {
      setError(err?.message || "Failed to deactivate employee.");
    } finally {
      setIsDeactivating(false);
    }
  };

  const busy = isDeleting || isDeactivating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-7 pt-7">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
              <IconTrash />
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-gray-900">Remove this employee?</h2>
              <p className="text-[13px] text-gray-500 mt-1">
                This action cannot be undone.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        {/* Details */}
        <div className="px-7 mt-6">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase">Employee ID</p>
                <p className="text-[14px] font-medium text-gray-900 mt-1">{employee.employee_id}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase">Name</p>
                <p className="text-[14px] font-medium text-gray-900 mt-1">{employee.first_name} {employee.last_name}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase">Department</p>
                <p className="text-[14px] font-medium text-gray-900 mt-1">{employee.department || "N/A"}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase">Designation</p>
                <p className="text-[14px] font-medium text-gray-900 mt-1">{employee.designation || "N/A"}</p>
              </div>
            </div>
          </div>

          {/* Consequence warning */}
          <div className="mt-4 bg-red-50 border border-red-100 rounded-lg p-4">
            <p className="text-[13px] font-semibold text-red-700">Deleting hides everything about this employee.</p>
            <p className="text-[12.5px] text-red-600 mt-1 leading-relaxed">
              Their profile, uploaded documents and document requests will no longer be
              accessible anywhere in the system — including HR document views.
            </p>
          </div>

          {canDeactivate && (
            <div className="mt-3 bg-orange-50 border border-orange-100 rounded-lg p-4">
              <p className="text-[13px] font-semibold text-[#d66f1b]">Has this employee just left the company?</p>
              <p className="text-[12.5px] text-[#b96317] mt-1 leading-relaxed">
                Mark them as <span className="font-semibold">Inactive</span> instead. Their details stay
                viewable in Employee Management and their documents remain available under
                Documents → Employee Documents.
              </p>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-[13px] mt-3 bg-red-50 border border-red-100 rounded-lg p-3">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-3 px-7 py-6 mt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium text-[14px] hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          {canDeactivate && (
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-[#EE7F22] text-white font-medium text-[14px] hover:bg-[#d66f1b] shadow-sm hover:shadow-md transition-all disabled:opacity-70"
            >
              {isDeactivating ? "Deactivating..." : "Mark as Inactive Instead"}
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="px-5 py-2.5 rounded-xl bg-red-500 text-white font-medium text-[14px] hover:bg-red-600 shadow-sm hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-70"
          >
            {isDeleting ? "Deleting..." : "Yes, Remove Employee"}
          </button>
        </div>
      </div>
    </div>
  );
}
