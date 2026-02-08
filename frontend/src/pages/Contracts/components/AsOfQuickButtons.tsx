// src/pages/Contracts/components/AsOfQuickButtons.tsx

import { toYyyyMmDd, endOfLastMonth, endOfLastQuarter, endOfLastYear } from "@/utils/asOfDates";

export function AsOfQuickButtons(props: { onPick: (yyyyMmDd: string) => void }) {
  const { onPick } = props;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onPick(toYyyyMmDd(new Date()))}
        className="px-3 py-1.5 rounded-full border text-sm hover:bg-gray-50"
      >
        Today
      </button>

      <button
        type="button"
        onClick={() => onPick(toYyyyMmDd(endOfLastMonth()))}
        className="px-3 py-1.5 rounded-full border text-sm hover:bg-gray-50"
      >
        End last month
      </button>

      <button
        type="button"
        onClick={() => onPick(toYyyyMmDd(endOfLastQuarter()))}
        className="px-3 py-1.5 rounded-full border text-sm hover:bg-gray-50"
      >
        End last quarter
      </button>

      <button
        type="button"
        onClick={() => onPick(toYyyyMmDd(endOfLastYear()))}
        className="px-3 py-1.5 rounded-full border text-sm hover:bg-gray-50"
      >
        End last year
      </button>
    </div>
  );
}
