// src/pages/Contracts/Modals/TimelineEventDetailModal.tsx

import React from "react";
import type { ContractValueTimelineEvent } from "@/types/ContractValue";
import { money } from "@/utils/format";

function labelValue(label: string, value: React.ReactNode) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="col-span-2 text-sm text-gray-900 break-words">{value}</div>
    </div>
  );
}

export function TimelineEventDetailsModal(props: {
  open: boolean;
  onClose: () => void;
  event: ContractValueTimelineEvent | null;
}) {
  const { open, onClose, event } = props;

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !event) return null;

  const effective = new Date(event.effectiveDate).toLocaleString();

  const delta = event.annualDelta;
  const deltaSign = delta > 0 ? "+" : "";
  const deltaColor =
    delta > 0 ? "text-green-700" : delta < 0 ? "text-red-700" : "text-gray-700";

  return (
    <div className="fixed inset-0 z-50">
      {/* backdrop */}
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* panel */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl border overflow-hidden">
          <div className="px-5 py-4 border-b flex items-start gap-3">
            <div className="min-w-0">
              <div className="text-lg font-semibold text-gray-900">
                Timeline Event Details
              </div>
              <div className="text-sm text-gray-500">
                Effective: {effective}
              </div>
            </div>

            <button
              className="ml-auto rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className="p-5 space-y-6">
            {/* Summary */}
            <div className="rounded-xl border bg-gray-50 p-4">
              <div className="text-xs text-gray-500 mb-1">Description</div>
              <div className="text-sm text-gray-900">
                {event.description || "—"}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-white border px-2.5 py-1 text-xs text-gray-700">
                  Change Type: {event.changeType}
                </span>
                <span className="inline-flex items-center rounded-full bg-white border px-2.5 py-1 text-xs text-gray-700">
                  Amendment #: {event.amendmentNumber || "—"}
                </span>
              </div>
            </div>

            {/* Numbers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border p-4">
                <div className="text-xs text-gray-500">Annual Delta</div>
                <div className={`text-2xl font-semibold ${deltaColor}`}>
                  {deltaSign}{money(delta)}
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="text-xs text-gray-500">Annual Value After</div>
                <div className="text-2xl font-semibold text-gray-900">
                  {money(event.annualValueAfter)}
                </div>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="text-xs text-gray-500">Effective Date</div>
                <div className="text-base font-semibold text-gray-900">
                  {new Date(event.effectiveDate).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Raw fields (handy for debugging) */}
            <div className="rounded-xl border p-4">
              <div className="text-sm font-semibold text-gray-900 mb-2">Fields</div>
              <div className="divide-y">
                {labelValue("effectiveDate", new Date(event.effectiveDate).toLocaleDateString())}
                {labelValue("description", event.description ?? "—")}
                {labelValue("changeType", event.changeType)}
                {labelValue("annualDelta", <span className={deltaColor}>{deltaSign}{money(delta)}</span>)}
                {labelValue("annualValueAfter", money(event.annualValueAfter))}
                {labelValue("amendmentNumber", event.amendmentNumber || "—")}
              </div>
            </div>
          </div>

          <div className="px-5 py-4 border-t flex justify-end gap-2">
            <button
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
