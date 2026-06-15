import React from "react";
import { useNavigate } from "react-router-dom";
import type { ContractLifecycleIntelligenceResponse } from "@/types/ContractLifecycle";

type Props = {
  lifecycle?: ContractLifecycleIntelligenceResponse;
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

const ContractLifecycleIntelligenceCard: React.FC<Props> = ({
  lifecycle,
  isLoading = false,
  error,
}) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Contract Lifecycle Intelligence
        </h2>
        <p className="text-sm text-gray-600 mt-2">
          Loading contract lifecycle intelligence...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Contract Lifecycle Intelligence
        </h2>
        <p className="text-sm text-red-600 mt-2">
          Unable to load contract lifecycle intelligence.
        </p>
      </section>
    );
  }

  if (!lifecycle) {
    return (
      <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Contract Lifecycle Intelligence
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          No lifecycle intelligence available for this contract.
        </p>
      </section>
    );
  }

  const { summary, replacementCandidates } = lifecycle;

  const hasMissingReplacementData =
    summary.assetsMissingReplacementValue > 0;

  const handleViewCoveredAssets = () => {
    navigate(`/assets?contractId=${lifecycle.contract._id}`);
  };

  const handleViewReplacementAssets = () => {
    navigate(`/assets?contractId=${lifecycle.contract._id}&replacementRecommended=true`);
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Contract Lifecycle Intelligence
          </h2>
          <p className="text-sm text-gray-500">
            Lifecycle health, replacement exposure, and data quality across
            assets covered by this contract.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleViewCoveredAssets}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            View Covered Assets
          </button>

          <button
            type="button"
            onClick={handleViewReplacementAssets}
            disabled={summary.replacementRecommendedCount === 0}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            View Replacement Flagged
          </button>
        </div>
      </div>

      {hasMissingReplacementData && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Data cleanup needed:</strong>{" "}
          {summary.assetsMissingReplacementValue} covered asset
          {summary.assetsMissingReplacementValue === 1 ? "" : "s"} missing
          replacement value data.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        <MetricTile
          label="Covered Assets"
          value={`${summary.hydratedAssetCount} / ${summary.coveredAssetCount}`}
          helper="Hydrated from asset records"
        />

        <MetricTile
          label="Replacement Recommended"
          value={formatPercent(summary.replacementRecommendedPercent)}
          helper={`${summary.replacementRecommendedCount} assets flagged`}
          emphasis={summary.replacementRecommendedCount > 0 ? "warning" : "normal"}
        />

        <MetricTile
          label="Projected Annual Maint."
          value={formatCurrency(summary.projectedAnnualMaintenance)}
          helper="Across covered assets"
        />

        <MetricTile
          label="Contract Value"
          value={formatCurrency(lifecycle.contract.totalValue)}
          helper="Annual/contract value"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <MetricTile
          label="Current Book Value"
          value={formatCurrency(summary.currentBookValue)}
          helper="Known asset book value"
        />

        <MetricTile
          label="Estimated Replacement Value"
          value={formatCurrency(summary.estimatedReplacementValue)}
          helper="Purchase or benchmark backed"
        />

        <MetricTile
          label="Missing Replacement Data"
          value={String(summary.assetsMissingReplacementValue)}
          helper="Assets needing purchase/benchmark data"
          emphasis={hasMissingReplacementData ? "warning" : "normal"}
        />
      </div>

      <section className="rounded-lg border border-gray-200">
        <div className="border-b border-gray-200 p-3">
          <h3 className="font-semibold text-gray-900">
            Replacement Candidates
          </h3>
          <p className="text-sm text-gray-500">
            Covered assets currently flagged by lifecycle rules.
          </p>
        </div>

        {replacementCandidates.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">
            No covered assets are currently flagged for replacement.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {replacementCandidates.map((asset) => (
              <div
                key={asset._id}
                className="p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div>
                  <div className="font-semibold text-gray-900">
                    {asset.ctrlNumber}
                  </div>
                  <div className="text-sm text-gray-600">
                    {asset.manufacturer} {asset.model}
                  </div>
                  {asset.serialNumber && (
                    <div className="text-xs text-gray-500">
                      S/N: {asset.serialNumber}
                    </div>
                  )}
                  {asset.replacementReason && (
                    <div className="mt-1 text-sm text-amber-700">
                      {asset.replacementReason}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <MiniStat
                    label="Years"
                    value={
                      typeof asset.yearsInService === "number"
                        ? asset.yearsInService.toFixed(1)
                        : "N/A"
                    }
                  />
                  <MiniStat
                    label="Book Value"
                    value={formatCurrency(asset.currentBookValue)}
                  />
                  <MiniStat
                    label="Replacement"
                    value={formatCurrency(asset.estimatedReplacementValue)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
};

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
    className={`rounded-lg border p-3 ${
      emphasis === "warning"
        ? "border-amber-300 bg-amber-50"
        : "border-gray-200 bg-gray-50"
    }`}
  >
    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
      {label}
    </div>
    <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
    {helper && <div className="mt-1 text-xs text-gray-500">{helper}</div>}
  </div>
);

const MiniStat = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
      {label}
    </div>
    <div className="font-semibold text-gray-900">{value}</div>
  </div>
);

export default ContractLifecycleIntelligenceCard;