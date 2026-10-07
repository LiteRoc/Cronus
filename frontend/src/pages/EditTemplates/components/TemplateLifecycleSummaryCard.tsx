import { FormCard } from '@/components/ui/formCard';
import LifecycleAggregateDetails from '@/components/lifecycle/LifecycleAggregateDetails';
import type { TemplateLifecycleSummaryResponse } from '@/types/EquipmentTemplate';
type Props = {
  summary?: TemplateLifecycleSummaryResponse;
  isLoading?: boolean;
  error?: unknown;
};
export default function TemplateLifecycleSummaryCard({
  summary,
  isLoading = false,
  error
}: Props) {
  return <FormCard title="Lifecycle Summary">{isLoading ? <p>Loading lifecycle summary...</p> : error ? <p>Unable to load lifecycle summary.</p> : !summary || summary.schemaVersion !== 'lifecycle-aggregate-v1' ? <p>No lifecycle summary available for this template.</p> : <>
    <h3 className="text-lg font-semibold">Template Fleet Lifecycle</h3>
    <p>Operational fleet: {summary.population.populationAssetCount} Active + Inactive Assets in the selected Facility. Pending / commissioning: {summary.population.pendingAssetCount}. Retired, archived and deleted Assets excluded.</p>
    <LifecycleAggregateDetails data={summary} />
  </>}</FormCard>;
}
