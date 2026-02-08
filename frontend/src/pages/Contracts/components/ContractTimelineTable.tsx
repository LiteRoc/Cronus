import { useMemo, useState } from "react";
import type { ContractValueTimelineEvent } from "@/types";
import { money } from "@/utils/format";

type SortKey = "date" | "delta" | "running";
type SortDir = "asc" | "desc";

function classNames(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function signedMoney(n: number) {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  const abs = Math.abs(n);
  return `${sign}${money(abs)}`;
}

function DeltaPill({ value }: { value: number }) {
  const positive = value > 0;
  const negative = value < 0;

  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        positive && "bg-green-50 text-green-700 ring-1 ring-green-200",
        negative && "bg-red-50 text-red-700 ring-1 ring-red-200",
        !positive && !negative && "bg-gray-50 text-gray-600 ring-1 ring-gray-200"
      )}
    >
      {signedMoney(value)}
    </span>
  );
}

function ChangeTypeBadge({ changeType }: { changeType?: string }) {
  if (!changeType) return null;

  const map: Record<string, string> = {
    add_asset: "Add",
    remove_asset: "Remove",
    pricing: "Pricing",
    inventory: "Inventory",
    update: "Update",
  };

  const label = map[changeType] ?? changeType;

  return (
    <span className="inline-flex items-center rounded-full bg-slate-50 text-slate-700 ring-1 ring-slate-200 px-2 py-0.5 text-xs font-medium">
      {label}
    </span>
  );
}

function SortHeader(props: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onChange: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const { label, sortKey, activeKey, dir, onChange, align = "left" } = props;
  const active = sortKey === activeKey;
  const arrow = !active ? "↕" : dir === "asc" ? "↑" : "↓";

  return (
    <button
      type="button"
      onClick={() => onChange(sortKey)}
      className={classNames(
        "inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-900",
        align === "right" && "justify-end w-full"
      )}
    >
      <span>{label}</span>
      <span className={classNames("text-[11px]", active ? "text-gray-900" : "text-gray-400")}>
        {arrow}
      </span>
    </button>
  );
}

export function ContractTimelineTable(props: {
  title: string;
  rows: (ContractValueTimelineEvent & { changeType?: string })[];
  defaultSort?: { key: SortKey; dir: SortDir };
  onRowClick?: (row: ContractValueTimelineEvent) => void;
}) {
  const { title, rows, defaultSort } = props;

  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>(defaultSort?.key ?? "date");
  const [sortDir, setSortDir] = useState<SortDir>(defaultSort?.dir ?? "asc");

  const onSortChange = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => (r.description ?? "").toLowerCase().includes(s));
  }, [rows, q]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;

      if (sortKey === "date") {
        const ad = new Date(a.effectiveDate).getTime();
        const bd = new Date(b.effectiveDate).getTime();
        return (ad - bd) * mul;
      }
      if (sortKey === "delta") return (a.annualDelta - b.annualDelta) * mul;
      return (a.annualValueAfter - b.annualValueAfter) * mul;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const netDelta = useMemo(
    () => sorted.reduce((sum, r) => sum + r.annualDelta, 0),
    [sorted]
  );

  const currentAnnual =
    sorted.length > 0 ? sorted[sorted.length - 1].annualValueAfter : null;

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="p-4 border-b flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-baseline gap-2">
          <div className="font-semibold text-gray-900">{title}</div>
          <div className="text-xs text-gray-500">{rows.length} events</div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search description…"
            className="border rounded-lg px-3 py-2 text-sm w-full md:w-[320px] focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full table-auto border-collapse">
          <thead className="bg-gray-50 text-gray-700 sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 border-b w-[140px]">
                <SortHeader
                  label="Amendment#"
                  sortKey="date"
                  activeKey={sortKey}
                  dir={sortDir}
                  onChange={onSortChange}
                />
              </th>
              <th className="text-left px-4 py-3 border-b w-[140px]">
                <SortHeader
                  label="Date"
                  sortKey="date"
                  activeKey={sortKey}
                  dir={sortDir}
                  onChange={onSortChange}
                />
              </th>

              <th className="text-left px-4 py-3 border-b">
                <div className="text-xs font-semibold">Description</div>
              </th>

              <th className="text-right px-4 py-3 border-b w-[160px]">
                <SortHeader
                  label="Delta"
                  sortKey="delta"
                  activeKey={sortKey}
                  dir={sortDir}
                  onChange={onSortChange}
                  align="right"
                />
              </th>

              <th className="text-right px-4 py-3 border-b w-[180px]">
                <SortHeader
                  label="Running Annual"
                  sortKey="running"
                  activeKey={sortKey}
                  dir={sortDir}
                  onChange={onSortChange}
                  align="right"
                />
              </th>
            </tr>
          </thead>

          <tbody className="text-sm">
            {sorted.map((r, idx) => {
              const dateLabel = new Date(r.effectiveDate).toLocaleDateString();

              return (
                <tr
                  key={r.amendmentId}
                  onClick={() => props.onRowClick?.(r)}
                  className={classNames(
                    "border-b last:border-b-0 cursor-pointer hover:bg-gray-50",
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50/40",
                    "hover:bg-gray-50"
                  )}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                    {r.amendmentNumber || "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                    {dateLabel}
                  </td>

                  <td className="px-4 py-3 text-gray-900">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0">
                        <div className="truncate">{r.description ?? "—"}</div>
                        <div className="mt-1 flex gap-2">
                          <ChangeTypeBadge changeType={(r as any).changeType} />
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    <DeltaPill value={r.annualDelta} />
                  </td>

                  <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-900">
                    {money(r.annualValueAfter)}
                  </td>
                </tr>
              );
            })}

            {sorted.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-sm text-gray-500" colSpan={4}>
                  No timeline items.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50 text-gray-900 font-semibold">
            <tr>
              <td className="px-4 py-3" colSpan={2}>
                Totals
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">
                <DeltaPill value={netDelta} />
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">
                {currentAnnual !== null ? money(currentAnnual) : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}