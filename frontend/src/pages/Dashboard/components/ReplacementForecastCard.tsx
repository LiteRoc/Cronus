import { Link } from 'react-router-dom';
import { CapitalAggregate } from '@/components/lifecycle/LifecycleAggregateDetails';
import type { ReplacementForecastResponse } from '@/types/Dashboard';
export type { ReplacementForecastResponse } from '@/types/Dashboard';
type Props = {
  forecast?: ReplacementForecastResponse;
  isLoading?: boolean;
  error?: unknown;
};
export default function ReplacementForecastCard({
  forecast,
  isLoading = false,
  error
}: Props) {
  return <section className="bg-white border rounded-xl shadow-sm p-4"><h2 className="text-lg font-semibold">Replacement Review Forecast</h2>
 {isLoading ? <p>Loading replacement forecast...</p> : error ? <p>Unable to load replacement forecast.</p> : !forecast || forecast.schemaVersion !== 'lifecycle-forecast-v2' ? <p>Current lifecycle forecast unavailable.</p> : <>
   <p>Adopted useful-life review horizon; replacement is not mandatory.</p>
   <p role="status">{forecast.lifecycleCoverage.freshEvaluated} of {forecast.lifecycleCoverage.eligiblePopulation} Assets have current lifecycle assessments; stale: {forecast.lifecycleCoverage.stale}; missing: {forecast.lifecycleCoverage.missing}; unsupported: {forecast.lifecycleCoverage.unsupported}. {forecast.isComplete ? 'Complete forecast.' : 'Partial forecast.'}</p>
   <p>Forecasted Assets: {forecast.totalForecastedAssets}; current assessments without projection evidence: {forecast.projectionUnavailableCount}.</p>
   <CapitalAggregate label="Forecast replacement estimates" value={forecast.capital} />
   {forecast.forecastYears.length === 0 && <p>No current assessments have sufficient adopted lifecycle evidence to forecast a review year.</p>}
   {forecast.forecastYears.map(year => <section key={year.year} className="my-3"><h3>{year.year}: {year.assetCount} Assets</h3><CapitalAggregate label="Replacement estimate" value={year.capital} />
     <details><summary>View forecast Assets</summary><ul>{year.assets.map(a => <li key={a._id}><Link to={`/assets/edit/${a._id}`} className="text-blue-700 underline">{a.ctrlNumber} {a.manufacturer} {a.model}</Link> — {a.replacementAssessmentState.replace(/_/g, ' ')}</li>)}</ul></details>
   </section>)}
   <p>Assessment coverage verified at {forecast.asOf}. Each cache's evaluation instant is exposed on its Asset listing.</p>
 </>}
 </section>;
}
