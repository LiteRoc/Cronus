import { Asset, AssetLifecycleResponse } from '@/types';
import type { LifecycleCapitalValue } from '@/types/AssetLifecycleAssessment';
import { FormCard } from '@/components/ui/formCard';

type Props = { asset: Asset; lifecycle?: AssetLifecycleResponse; isLoading?: boolean; error?: unknown };
const sources: Record<string, string> = {
  service_start: 'Confirmed service start', installation: 'Installation / commissioning',
  acquisition_proxy: 'Estimated from acquisition date', purchase_proxy: 'Estimated from purchase date',
  asset_override: 'Approved Asset policy', organization_policy: 'Approved organization policy', adopted_benchmark: 'Adopted benchmark',
  legacy_asset: 'Provisional legacy Asset value', legacy_template_default: 'Provisional Template default', legacy_template: 'Provisional legacy Template value',
  external_reference: 'Reference only — not adopted', asset_purchase: 'Recorded purchase', legacy_purchase_cost: 'Legacy purchase cost',
  template_average_quoted_price: 'Template quoted-price benchmark', template_average_list_price: 'Template list-price benchmark',
};
const formatCapital = (value: LifecycleCapitalValue) => {
  if (value.amount === null) return 'Unavailable';
  if (!value.currency) return `${value.amount.toLocaleString('en-US', {maximumFractionDigits: 2})} (currency unspecified)`;
  return new Intl.NumberFormat('en-US', {style: 'currency', currency: value.currency}).format(value.amount);
};
const dollars = (value: number | null | undefined) => typeof value === 'number' ? new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(value) : 'Unavailable';
const label = (type?: string) => type ? sources[type] ?? type : 'Source unavailable';
const dateText = (value: string) => new Date(value).toLocaleDateString();
export default function AssetLifecycleCard({asset, lifecycle, isLoading = false, error}: Props) {
  if (isLoading) return <FormCard title="Lifecycle"><p>Loading lifecycle assessment...</p></FormCard>;
  if (error) return <FormCard title="Lifecycle"><p role="alert">Unable to load lifecycle assessment.</p></FormCard>;
  const assessment = lifecycle?.assessment;
  if (!assessment) return <FormCard title="Lifecycle"><p role="status">Current lifecycle assessment unavailable. Stored metrics cannot establish current lifecycle status.</p></FormCard>;
  const {serviceAge, expectedLife, capital, maintenance, replacementAssessment, quality} = assessment;
  const stateLabels = {recommended: 'Recommended for replacement review', not_recommended: 'Replacement review not recommended', insufficient_data: 'Insufficient data for replacement review'};
  const ageText = serviceAge.years !== null ? `${serviceAge.years.toFixed(2)} years${serviceAge.isProxy ? ' (estimated proxy)' : ''}` : {unknown: 'Unknown', invalid: 'Invalid service date', not_started: 'Not started', resolved: 'Unavailable', estimated: 'Unavailable'}[serviceAge.status];
  const progress = serviceAge.years !== null && expectedLife.years !== null && expectedLife.years > 0 ? Math.min(100, serviceAge.years / expectedLife.years * 100) : null;
  const direct = maintenance.last365Days?.directMaintenance;
  return <FormCard title="Lifecycle">
    <div className="space-y-5">
      <h3 className="text-lg font-semibold">Asset Lifecycle Assessment — {asset.ctrlNumber}</h3>
      <p role="status" className={replacementAssessment.state === 'recommended' ? 'text-amber-800' : replacementAssessment.state === 'insufficient_data' ? 'text-gray-700' : 'text-green-800'}>{stateLabels[replacementAssessment.state]}</p>
      <p>{replacementAssessment.displayText}</p>
      <p className="text-sm text-gray-600">Review guidance; this is not a mandatory replacement instruction.</p>
      <section aria-label="Service age" className="space-y-1">
        <h4 className="font-semibold">Years in Service</h4><p>{ageText}</p><p>{label(serviceAge.source?.type)}</p>
        {serviceAge.startDate && <p>Start: {dateText(serviceAge.startDate)}</p>}
        <h4 className="font-semibold">Expected Life</h4><p>{expectedLife.years === null ? expectedLife.status === 'disabled' ? 'Age policy disabled' : 'Unavailable' : `${expectedLife.years} years`}</p>
        <p>{label(expectedLife.source?.type)}</p>
        {expectedLife.source?.reference && <p>Evidence: {expectedLife.source.reference}</p>}
        {expectedLife.referenceYears != null && <p>Reference: {expectedLife.referenceYears} years; not adopted as policy.</p>}
        {progress !== null && <progress aria-label="Expected-life progress" max={100} value={progress} />}
      </section>
      <section aria-label="Lifecycle capital" className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {([['Acquisition Basis',capital.acquisitionBasis],['Estimated Depreciated Value',capital.estimatedDepreciatedValue],['Replacement Estimate',capital.replacementValue],['Accounting Book Value',capital.accountingBookValue]] as const).map(([name,value]) => <div key={name} className="rounded border p-3"><h4 className="font-semibold">{name}</h4><p>{formatCapital(value)}</p>{value.source && <p>{label(value.source.type)}</p>}{value.source?.sourceDate && <p>Source date: {dateText(value.source.sourceDate)}</p>}{value.source?.confidence && <p>Confidence: {value.source.confidence}</p>}{value.missingInputs?.length ? <p>Missing: {value.missingInputs.map(v=>v.replace(/_/g,' ')).join(', ')}</p> : null}</div>)}
      </section>
      <p>Planning salvage: {capital.salvage.planningAmount ?? 'Unknown'}{capital.salvage.basis === 'assumption' ? ' — zero salvage assumption' : ` — ${capital.salvage.basis}`}</p>
      {capital.salvage.basis === 'assumption' && <p className="text-sm">Planning estimates use assumed zero salvage; recorded salvage is not known zero.</p>}
      <section aria-label="Direct maintenance costs" className="space-y-2">
        <h4 className="font-semibold">Direct Maintenance Cost — Last 365 Days</h4>
        {direct?.isComplete ? <p>{dollars(direct.total)}</p> : <p>Incomplete — known subtotal {dollars(direct?.knownSubtotal)}</p>}
        {!!direct?.missingComponents.length && <p>Missing components: {[...new Set(direct.missingComponents.map(c => c.component ?? c.reason))].join(', ')}</p>}
        <p className="text-sm">Completed Work Orders by completion date, {dateText(maintenance.window.start)} through {dateText(maintenance.window.end)}. Observed costs; no maintenance-based replacement threshold is configured.</p>
      </section>
      {quality.assumptions.length > 0 && <p>Assumptions: {quality.assumptions.map(v=>v.replace(/_/g,' ')).join(', ')}</p>}
      {quality.conflicts.length > 0 && <p>Data needs review: {quality.conflicts.map(v=>v.replace(/_/g,' ')).join(', ')}</p>}
      <p className="text-xs text-gray-500">Assessment date: {dateText(assessment.asOf)}</p>
    </div>
  </FormCard>;
}
