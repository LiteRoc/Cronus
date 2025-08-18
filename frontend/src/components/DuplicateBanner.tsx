import React from "react";
import { useNavigate } from "react-router-dom";

type Props = {
  entity: "asset" | "template";
  selfId: string;                  // current doc _id
  duplicateOf?: string;
  warning?: string;
  matchedOn?: string[];
  onDismiss?: () => void;
};

const keyFor = (entity: string, selfId: string, duplicateOf?: string) =>
  `dup-dismissed:${entity}:${selfId}:${duplicateOf ?? "none"}`;

const DuplicateBanner: React.FC<Props> = ({ entity, selfId, duplicateOf, warning, matchedOn, onDismiss }) => {
  const navigate = useNavigate();
  if (!warning && !duplicateOf) return null;

  const storageKey = keyFor(entity, selfId, duplicateOf);
  const dismissed = !!localStorage.getItem(storageKey);
  if (dismissed) return null;

  return (
    <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-yellow-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">Possible duplicate detected</div>
          {warning && <div className="text-sm mt-1">{warning}</div>}
          {!!matchedOn?.length && (
            <div className="text-xs mt-1 italic">Matched on: {matchedOn.join(", ")}</div>
          )}
          {duplicateOf && (
            <button
              type="button"
              onClick={() => navigate(entity === "asset" ? `/assets/edit/${duplicateOf}` : `/templates/edit/${duplicateOf}`)}
              className="mt-2 inline-flex items-center rounded bg-yellow-600 px-3 py-1 text-white hover:bg-yellow-700"
            >
              View Original
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(storageKey, "1");
            onDismiss?.();
          }}
          className="text-sm underline hover:opacity-80"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default DuplicateBanner;