import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { LifecycleAggregation, LifecycleMoneyAggregate } from '@/types/LifecycleAggregation';
export function money(amount: number | null, currency: string | null) {
  if (amount === null) return 'Unavailable';
  return currency ? new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(amount) : `${amount.toLocaleString('en-US')} (currency unknown)`;
}
export function CapitalAggregate({
  label,
  value
}: {
  label: string;
  value: LifecycleMoneyAggregate;
}) {
  return <section className="border rounded-lg p-3"><h3 className="font-semibold">{label}</h3>
    <p>{value.isComplete ? 'Total' : 'Known subtotal'}: {money(value.isComplete ? value.total : value.knownSubtotal, value.currency)}</p>
    {!value.isComplete && <>
      <p className="text-amber-800">Incomplete: {value.missingAssetCount} Assets missing/unavailable; {value.currencyUnknownAssetCount} with unknown currency.</p>
      {value.currencyGroups.length > 1 && <p>Multiple currencies; no combined total.</p>}
      {value.currencyGroups.length > 1 && value.currencyGroups.map(g => <p key={g.currency}>{g.currency} known subtotal: {money(g.knownSubtotal, g.currency)}</p>)}
      {value.unidentifiedCurrencyValues.map(v => <p key={v.assetId}>Asset {v.assetId}: {money(v.amount, null)}</p>)}
    </>}
    <p>{value.valuedAssetCount} valued of {value.populationAssetCount} Assets</p>
  </section>;
}
export default function LifecycleAggregateDetails({
  data
}: {
  data: LifecycleAggregation;
}) {
  const [members, setMembers] = useState<'all' | 'recommended' | null>(null);
  const p = data.population,
    r = data.replacementReview,
    m = data.maintenance.directMaintenance,
    w = data.maintenance.window;
  const selected = data.members.filter(row => members === 'all' || row.replacementAssessment?.state === 'recommended');
  const percentage = (v: number | null) => v === null ? 'Unavailable' : `${v}%`;
  return <div className="space-y-4 text-sm">
    <p>Assessed Assets: {p.assessedAssetCount} / {p.populationAssetCount}; unavailable: {p.unavailableAssessmentCount}</p>
    <section><h3 className="font-semibold">Replacement Review</h3>
      <p>Recommended for review: {r.recommendedCount}; not recommended: {r.notRecommendedCount}; insufficient data: {r.insufficientDataCount}; assessment unavailable: {r.unavailableAssessmentCount}</p>
      <p>Recommended: {percentage(r.recommendedPercentOfPopulation)} of population ({r.populationAssetCount}); {percentage(r.recommendedPercentOfEvaluated)} of evaluated Assets ({r.evaluatedCount})</p>
    </section>
    <section><h3 className="font-semibold">Service Age</h3>
      <ul>{data.age.buckets.map(b => <li key={b.key}>{b.label}: {b.count}</li>)}</ul>
      <p>Estimated/proxy: {data.age.stateCounts.estimated}; unknown: {data.age.stateCounts.unknown}; invalid: {data.age.stateCounts.invalid}; not started: {data.age.stateCounts.not_started}; unavailable: {data.age.stateCounts.unavailable}</p>
    </section>
    <CapitalAggregate label="Replacement estimate" value={data.capital.replacementValue} />
    <CapitalAggregate label="Estimated depreciated value" value={data.capital.estimatedDepreciatedValue} />
    <CapitalAggregate label="Accounting book value" value={data.capital.accountingBookValue} />
    <section className="border rounded-lg p-3"><h3 className="font-semibold">Direct Maintenance Cost — Last 365 Days</h3>
      <p>{m.isComplete ? 'Total' : 'Known subtotal'}: {money(m.isComplete ? m.total : m.knownSubtotal, m.currency)}</p>
      {!m.isComplete && <p className="text-amber-800">Incomplete: {m.incompleteAssetCount} Assets; {m.missingComponents.length} missing components or assessments.</p>}
      <p>Fleet mean: {money(m.statistics.fleetMean, m.currency)}</p>
      <p>Complete-record sample mean: {money(m.statistics.completeRecordSampleMean, m.currency)} ({m.statistics.sampleAssetCount} of {m.statistics.populationAssetCount} Assets)</p>
      <p>WorkOrders: {m.workOrders.knownCount} known; {m.workOrders.isComplete ? 'counts complete' : 'counts incomplete'}; {m.workOrders.knownFullyPricedCount} fully priced.</p>
      <p>Rolling {w.durationDays} days: {w.start} through {w.end} ({w.startInclusive ? 'inclusive' : 'exclusive'} start; {w.endInclusive ? 'inclusive' : 'exclusive'} end). {w.statuses.join(', ')} WorkOrders, {w.dateField}.</p>
      <p>Valuation bases: {m.valuationBases.join(', ') || 'No priced work'}</p>
    </section>
    <div className="flex gap-3">
      <button className="border rounded px-3 py-2" onClick={() => setMembers('all')}>View Assets ({p.populationAssetCount})</button>
      <button className="border rounded px-3 py-2" onClick={() => setMembers('recommended')}>View Replacement Review ({r.recommendedCount})</button>
    </div>
    {members && <section aria-label="Lifecycle members"><h3 className="font-semibold">{members === 'all' ? 'Population Assets' : 'Recommended for review'}</h3>
      {selected.length === 0 ? <p>No Assets in this selection.</p> : <ul>{selected.map(row => <li key={row.assetId} className="py-1">
        {row.asset ? <Link className="text-blue-700 underline" to={`/assets/edit/${row.assetId}`}>{row.asset.ctrlNumber || row.assetId} {row.asset.manufacturer} {row.asset.model}</Link> : <span>Asset {row.assetId}: unavailable</span>}
        <span> — {row.replacementAssessment?.displayText || row.reason || 'Assessment unavailable'}</span>
      </li>)}</ul>}
    </section>}
    <p className="text-gray-500">Lifecycle assessed at {data.asOf}. This review does not mandate replacement.</p>
  </div>;
}
