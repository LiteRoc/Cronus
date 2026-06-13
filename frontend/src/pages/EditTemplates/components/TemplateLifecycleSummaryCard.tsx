import React from "react";
import { useNavigate } from "react-router-dom";
import { FormCard } from "@/components/ui/formCard";
import type { TemplateLifecycleSummaryResponse } from "@/types/EquipmentTemplate";

type Props = {
  summary?: TemplateLifecycleSummaryResponse;
  isLoading?: boolean;
  error?: unknown;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

const formatCurrency = (value: unknown) =>
  typeof value === "number" ? currencyFormatter.format(value) : "N/A";

const formatPercent = (value: unknown) =>
  typeof value === "number" ? percentFormatter.format(value / 100) : "N/A";

const TemplateLifecycleSummaryCard: React.FC<Props> = ({
  summary,
  isLoading = false,
  error,
}) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <FormCard title="Lifecycle Summary">
        <p className="text-sm text-gray-600">Loading lifecycle summary...</p>
      </FormCard>
    );
  }

  if (error) {
    return (
      <FormCard title="Lifecycle Summary">
        <p className="text-sm text-red-600">
          Unable to load lifecycle summary.
        </p>
      </FormCard>
    );
  }

  if (!summary) {
    return (
      <FormCard title="Lifecycle Summary">
        <p className="text-sm text-gray-500">
          No lifecycle summary available for this template.
        </p>
      </FormCard>
    );
  }

  const { summary: metrics, lifecycleDefaults, benchmarks, links } = summary;
  const ageBuckets = metrics.ageBuckets;

  const handleViewAssets = () => {
    navigate(links.assets);
  };

  const handleViewReplacementAssets = () => {
    navigate(links.replacementRecommendedAssets);
  };

  return (
    <FormCard title="Lifecycle Summary">
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Template Fleet Lifecycle
          </h3>
          <p className="text-sm text-gray-500">
            Aggregated lifecycle metrics across deployed assets for this template.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <AgeBucketTile label="0–2y" count={ageBuckets["0-2"]} />
          <AgeBucketTile label="3–5y" count={ageBuckets["3-5"]} />
          <AgeBucketTile label="6–8y" count={ageBuckets["6-8"]} />
          <AgeBucketTile label=">8y" count={ageBuckets[">8"]} />
          <AgeBucketTile label="Unknown" count={ageBuckets.unknown} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetricTile
            label="Deployed Assets"
            value={String(metrics.totalAssets)}
            helper="Active/non-retired assets"
          />

          <MetricTile
            label="Avg Annual Maintenance"
            value={formatCurrency(metrics.averageAnnualMaintenancePerAsset)}
            helper={`${metrics.maintenanceSampleCount} asset sample`}
          />

          <MetricTile
            label="Replacement Flagged"
            value={formatPercent(metrics.replacementRecommendedPercent)}
            helper={`${metrics.replacementRecommendedCount} of ${metrics.totalAssets} assets`}
            emphasis={metrics.replacementRecommendedCount > 0 ? "warning" : "normal"}
          />
        </div>

        <section className="rounded-lg border border-gray-200 p-4">
          <h4 className="font-semibold text-gray-800 mb-3">
            Lifecycle Defaults
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <InfoRow
              label="Expected Useful Life"
              value={
                lifecycleDefaults.expectedLifeYears !== null
                  ? `${lifecycleDefaults.expectedLifeYears} years`
                  : "N/A"
              }
            />
            <InfoRow
              label="Typical Annual Maintenance"
              value={formatCurrency(lifecycleDefaults.typicalAnnualMaintenance)}
            />
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 p-4">
          <h4 className="font-semibold text-gray-800 mb-3">
            Maintenance Benchmark Snapshot
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BenchmarkBlock title="Tenant" benchmark={benchmarks.tenant} />
            <BenchmarkBlock title="Global" benchmark={benchmarks.global} />
          </div>
        </section>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleViewAssets}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            View Assets
          </button>

          <button
            type="button"
            onClick={handleViewReplacementAssets}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            disabled={metrics.replacementRecommendedCount === 0}
          >
            View Replacement Flagged
          </button>
        </div>
      </div>
    </FormCard>
  );
};

const AgeBucketTile = ({
  label,
  count,
}: {
  label: string;
  count: number;
}) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
      {label}
    </div>
    <div className="mt-1 text-2xl font-semibold text-gray-900">{count}</div>
  </div>
);

const MetricTile = ({
  label,
  value,
  helper,
  emphasis = "normal",
}: {
  label: string;
  value: string;
  helper?: string;
  emphasis?: "normal" | "warning";
}) => (
  <div
    className={`rounded-lg border p-4 ${
      emphasis === "warning"
        ? "border-amber-300 bg-amber-50"
        : "border-gray-200 bg-gray-50"
    }`}
  >
    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
      {label}
    </div>
    <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
    {helper && <div className="mt-1 text-xs text-gray-500">{helper}</div>}
  </div>
);

const InfoRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div>
    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
      {label}
    </div>
    <div className="text-gray-900">{value || "N/A"}</div>
  </div>
);

const BenchmarkBlock = ({
  title,
  benchmark,
}: {
  title: string;
  benchmark: {
    sampleAssets: number;
    avgAnnualMaintenance: number;
    medianAnnualMaintenance: number;
    sampleWOsAnnual: number;
    avgLifetimeMaintenance: number;
    sampleWOsLifetime: number;
  };
}) => (
  <div className="rounded-lg border border-gray-200 bg-white p-3">
    <h5 className="font-semibold text-gray-800 mb-2">{title}</h5>

    <div className="space-y-2 text-sm">
      <InfoRow label="Sample Assets" value={benchmark.sampleAssets} />
      <InfoRow
        label="Avg Annual Maintenance"
        value={formatCurrency(benchmark.avgAnnualMaintenance)}
      />
      <InfoRow
        label="Median Annual Maintenance"
        value={formatCurrency(benchmark.medianAnnualMaintenance)}
      />
      <InfoRow label="Annual WO Sample" value={benchmark.sampleWOsAnnual} />
      <InfoRow
        label="Avg Lifetime Maintenance"
        value={formatCurrency(benchmark.avgLifetimeMaintenance)}
      />
      <InfoRow label="Lifetime WO Sample" value={benchmark.sampleWOsLifetime} />
    </div>
  </div>
);

export default TemplateLifecycleSummaryCard;