import LifecycleAggregateDetails, { money } from '@/components/lifecycle/LifecycleAggregateDetails';
import type { ContractLifecycleIntelligenceResponse } from '@/types/ContractLifecycle';
type Props = {
  lifecycle?: ContractLifecycleIntelligenceResponse;
  isLoading?: boolean;
  error?: unknown;
};
export default function ContractLifecycleIntelligenceCard({
  lifecycle,
  isLoading = false,
  error
}: Props) {
  return <section className="bg-white border rounded-xl shadow-sm p-4"><h2 className="text-lg font-semibold">Contract Lifecycle Intelligence</h2>
    {isLoading ? <p>Loading contract lifecycle intelligence...</p> : error ? <p>Unable to load contract lifecycle intelligence.</p> : !lifecycle || lifecycle.schemaVersion !== 'lifecycle-aggregate-v1' ? <p>No lifecycle intelligence available for this contract.</p> : <>
      <p>Covered Assets: {lifecycle.population.populationAssetCount}. Current Contract coverage only; vendor responsibility does not expand membership.</p>
      <p>Original base annual value: {money(lifecycle.contract.totalValue, 'USD')}</p>
      <LifecycleAggregateDetails data={lifecycle} />
    </>}
  </section>;
}
