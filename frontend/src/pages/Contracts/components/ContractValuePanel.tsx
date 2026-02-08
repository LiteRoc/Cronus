// src/pages/Contracts/components/ContractValuePanel.tsx

import type { ContractValueResponse } from "@/types/ContractValue";
import { AsOfQuickButtons } from "./AsOfQuickButtons";
import { money } from "@/utils/format";

//const money = (n?: number) =>
  //typeof n === "number" ? n.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "—";

export function ContractValuePanel(props: {
  asOf: string;
  setAsOf: (v: string) => void;
  value?: ContractValueResponse;
  loading?: boolean;
}) {
  const { asOf, setAsOf, value, loading } = props;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">As-of date</label>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>

        <AsOfQuickButtons onPick={setAsOf} />

        {loading && <div className="text-sm text-gray-500">Calculating…</div>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border p-4">
          <div className="text-xs text-gray-500">Annual Base</div>
          <div className="text-2xl font-semibold">{money(value?.annualBase)}</div>
        </div>

        <div className="rounded-2xl border p-4">
          <div className="text-xs text-gray-500">Delta Applied (as-of)</div>
          <div className="text-2xl font-semibold">{money(value?.annualDeltaApplied)}</div>
        </div>

        <div className="rounded-2xl border p-4">
          <div className="text-xs text-gray-500">Annual Value (as-of)</div>
          <div className="text-2xl font-semibold">{money(value?.annualValueAsOf)}</div>
        </div>

        <div className="rounded-2xl border p-4">
          <div className="text-xs text-gray-500">Remaining Term Value</div>
          <div className="text-2xl font-semibold">{money(value?.remainingTermValue)}</div>
        </div>
      </div>
    </div>
  );
}
