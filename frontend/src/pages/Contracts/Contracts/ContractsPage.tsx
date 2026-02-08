// src/pages/Contracts/Contracts/ContractsPage.tsx

import { useFacilityContracts } from "@/hooks/useFacilityContracts";
import { getContractById } from "@/services/contractAPI";
import { Contract } from "@/types/Contract";
import { useNavigate } from "react-router-dom";
import ContractsListSkeleton from "@/components/ui/ContractListSkeleton";

const fmtCurrency = (n?: number) =>
  typeof n === "number" ? n.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "—";

const daysLeft = (endDate?: string) => {
  if (!endDate) return null;
  const ms = new Date(endDate).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const cls =
    status === "active" ? "bg-green-100 text-green-700" :
    status === "pending" ? "bg-amber-100 text-amber-700" :
    "bg-gray-100 text-gray-700";
  return <span className={`text-xs px-2 py-1 rounded-full ${cls}`}>{status ?? "—"}</span>;
};

export default function ContractsPage() {
  const nav = useNavigate();
  const { contracts, isLoading } = useFacilityContracts();

  if (isLoading) return <ContractsListSkeleton />;
  if (!contracts?.length) return <div className="p-6">No contracts yet.</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Contracts</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {contracts.map((c: Contract) => {
          const dLeft = daysLeft(c.endDate as unknown as string);
          return (
            <button
              key={c._id}
              onClick={() => nav(`/contracts/${c._id}`)}
              className="text-left rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-gray-300 transition"
            >
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold">{c.name}</h3>
                <StatusBadge status={c.status} />
              </div>

              <div className="mt-3 text-sm text-gray-600">
                <div><span className="font-medium">Type:</span> {c.type}</div>
                <div className="mt-1">
                  <span className="font-medium">Term:</span>{" "}
                  {c.startDate ? new Date(c.startDate).toLocaleDateString() : "—"} →{" "}
                  {c.endDate ? new Date(c.endDate).toLocaleDateString() : "—"}
                  {typeof dLeft === "number" && (
                    <span className={`ml-2 text-xs ${dLeft <= 30 ? "text-red-600" : "text-gray-500"}`}>
                      ({dLeft} days left)
                    </span>
                  )}
                </div>
                <div className="mt-1"><span className="font-medium">Total Value:</span> {fmtCurrency(c.totalValue)}</div>
              </div>

              {!!(c as any)?.coveredAssets?.length && (
                <div className="mt-3 text-xs text-gray-500">
                  Covers {(c as any).coveredAssets.length} asset{(c as any).coveredAssets.length > 1 ? "s" : ""}
                </div>
              )}
            </button>
          );
        })}

        <button
          onClick={async () => {
            const data = await getContractById("6907740cfed0525fb4d861e0");
            console.log("Contract data test:", data);
          }}
        >
          Test Contract API
        </button>
              
      </div>
    </div>
  );
}
