import type { WorkOrderCosts } from '@/types/WorkOrderCosts';
import { fmtMoney } from '@/utils/format';
export default function WorkOrderCostSummary({ costs }: { costs?: WorkOrderCosts }) {
  if (!costs?.scopes) return <p>Historical economics are unverified.</p>;
  return <section aria-label="Work Order costs" className="rounded border bg-white p-4 space-y-2">
    <h2 className="font-semibold">Recorded direct service costs</h2>
    {costs.cacheState !== 'current' && <p>Pricing state: {costs.cacheState}. Values may be incomplete.</p>}
    {([['internal','Internal'],['vendorDirect','Vendor direct'],['directMaintenance','Direct maintenance']] as const).map(([key,label]) => {
      const scope=costs.scopes[key];
      return <div key={key}><strong>{label}:</strong> {scope.isComplete ? fmtMoney(scope.total) : `Incomplete — known subtotal ${fmtMoney(scope.knownSubtotal)}`}</div>;
    })}
    <p className="text-sm text-gray-600">Recorded costs may use blended or catalog-default values. Revenue and annual vendor payments are excluded.</p>
  </section>;
}
