// src/pages/EditAsset/components/AssetLifecycleCard.tsx

import React from "react";
import { Asset, AssetLifecycleResponse } from "@/types";
import { FormCard } from "@/components/ui/formCard";

type Props = {
  asset: Asset;
  lifecycle?: AssetLifecycleResponse;
  isLoading?: boolean;
  error?: unknown;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 2,
});

const formatCurrency = (value: unknown) =>
  typeof value === "number" ? currencyFormatter.format(value) : "N/A";

const formatNumber = (value: unknown, digits = 1) =>
  typeof value === "number" ? value.toFixed(digits) : "N/A";

const formatPercentFromDecimal = (value: unknown) =>
  typeof value === "number" ? percentFormatter.format(value) : "N/A";

const formatDate = (value: unknown) => {
  if (!value || typeof value !== "string") return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
};

const getProgressPercent = (yearsInService?: number, expectedLife?: number) => {
  if (!yearsInService || !expectedLife) return 0;
  return Math.min((yearsInService / expectedLife) * 100, 100);
};

const AssetLifecycleCard: React.FC<Props> = ({
  asset,
  lifecycle,
  isLoading = false,
  error,
}) => {
  const metrics = lifecycle?.metrics ?? asset?.metrics;
  const comparison = lifecycle?.benchmarkComparison ?? asset?.benchmarkComparison;
  const benchmark =
    lifecycle?.template?.benchmark ??
    (typeof asset.templateId === "object" ? asset.templateId?.benchmark : undefined);
  const purchase = lifecycle?.purchase;

  const yearsInService = metrics?.yearsInService;
  const expectedLife = benchmark?.expectedUsefulLifeYears;

  const progressPercent = getProgressPercent(yearsInService, expectedLife);

  const replacementRecommended = !!metrics?.replacementRecommended;

  if (isLoading) {
    return (
      <FormCard title="Lifecycle">
        <p className="text-sm text-gray-600">Loading lifecycle metrics...</p>
      </FormCard>
    );
  }

  if (error) {
    return (
      <FormCard title="Lifecycle">
        <p className="text-sm text-red-600">
          Unable to load lifecycle metrics.
        </p>
      </FormCard>
    );
  }

  return (
    <FormCard title="Lifecycle">
      <div className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Asset Lifecycle Summary
            </h3>
            <p className="text-sm text-gray-500">
              Maintenance cost, age, book value, and ECRI benchmark comparison.
            </p>
          </div>

          <span
            className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
              replacementRecommended
                ? "bg-red-100 text-red-800"
                : "bg-green-100 text-green-800"
            }`}
          >
            {replacementRecommended
              ? "Replace Recommended"
              : "Within Expected Life"}
          </span>
        </div>

        {metrics?.replacementReason && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Reason:</strong> {metrics.replacementReason}
          </div>
        )}

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">Years in Service</span>
            <span className="text-gray-600">
              {formatNumber(yearsInService)} / {formatNumber(expectedLife)} years
            </span>
          </div>

          <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                progressPercent >= 100
                  ? "bg-red-500"
                  : progressPercent >= 75
                    ? "bg-yellow-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <MetricTile
            label="Current Book Value"
            value={formatCurrency(metrics?.currentBookValue)}
          />
          <MetricTile
            label="Total Maintenance"
            value={formatCurrency(metrics?.totalMaintenanceCost)}
          />
          <MetricTile
            label="Last 12 Months"
            value={formatCurrency(metrics?.last12MonthsMaintenanceCost)}
          />
          <MetricTile
            label="Projected Annual"
            value={formatCurrency(metrics?.projectedAnnualMaintenance)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetricTile
            label="Actual CCR"
            value={formatPercentFromDecimal(comparison?.actualCapitalCostRatio)}
          />
          <MetricTile
            label="ECRI CCR"
            value={formatPercentFromDecimal(comparison?.expectedCapitalCostRatio)}
          />
          <MetricTile
            label="CCR Variance"
            value={formatPercentFromDecimal(comparison?.ccrVariance)}
          />
        </div>

        <section className="rounded-lg border border-gray-200 p-4">
          <h4 className="font-semibold text-gray-800 mb-3">ECRI Benchmark</h4>

          {benchmark ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <InfoRow label="Source" value={benchmark.source} />
              <InfoRow label="Report Date" value={formatDate(benchmark.reportDate)} />
              <InfoRow label="Expected Useful Life" value={`${formatNumber(benchmark.expectedUsefulLifeYears)} years`} />
              <InfoRow label="Average Quoted Price" value={formatCurrency(benchmark.averageQuotedPrice)} />
              <InfoRow label="Expected Annual Maintenance" value={formatCurrency(benchmark.expectedAnnualMaintenance)} />
              <InfoRow label="Expected Capital Cost Ratio" value={formatPercentFromDecimal(benchmark.expectedCapitalCostRatio)} />
              <InfoRow label="Confidence" value={benchmark.confidence ?? "N/A"} />
              <InfoRow label="Market Interest" value={benchmark.marketInterest ?? "N/A"} />
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No benchmark information available.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 p-4">
          <h4 className="font-semibold text-gray-800 mb-3">
            Purchase Information
          </h4>

          {purchase ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {Object.entries(purchase).map(([key, value]) => (
                <InfoRow key={key} label={key} value={String(value ?? "N/A")} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <InfoRow label="Purchase Date" value={formatDate(asset.purchaseDate)} />
              <InfoRow label="Purchase Cost" value={formatCurrency(asset.purchaseCost)} />
              <InfoRow label="Budget Value" value={formatCurrency(asset.budgetValue)} />
              <InfoRow label="Contract Value" value={formatCurrency(asset.contractValue)} />
            </div>
          )}
        </section>

        <div className="text-xs text-gray-500">
          Last lifecycle update: {formatDate(metrics?.computedAt)}
        </div>
      </div>
    </FormCard>
  );
};

const MetricTile = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
      {label}
    </div>
    <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
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

export default AssetLifecycleCard;