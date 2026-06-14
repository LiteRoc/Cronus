import React from "react";
import { useNavigate } from "react-router-dom";

type ForecastAsset = {
  _id: string;
  templateId?: string | null;
  ctrlNumber: string;
  manufacturer: string;
  model: string;
  estimatedReplacementCost: number;
};

type ForecastYear = {
  year: number;
  assetCount: number;
  estimatedCapitalNeed: number;
  assets: ForecastAsset[];
};

export type ReplacementForecastResponse = {
  forecastYears: ForecastYear[];
  totalForecastedAssets: number;
  totalAssetsEvaluated: number;
  totalEstimatedCapitalNeed: number;
};

type Props = {
  forecast?: ReplacementForecastResponse;
  isLoading?: boolean;
  error?: unknown;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const formatCurrency = (value: unknown) =>
  typeof value === "number" ? currencyFormatter.format(value) : "N/A";

const ReplacementForecastCard: React.FC<Props> = ({
  forecast,
  isLoading = false,
  error,
}) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Replacement Forecast
        </h2>
        <p className="text-sm text-gray-600 mt-2">
          Loading replacement forecast...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Replacement Forecast
        </h2>
        <p className="text-sm text-red-600 mt-2">
          Unable to load replacement forecast.
        </p>
      </section>
    );
  }

  if (!forecast || forecast.forecastYears.length === 0) {
    return (
      <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Replacement Forecast
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          No assets currently have enough lifecycle data to forecast replacement.
        </p>
      </section>
    );
  }

  const coveragePercent =
    forecast.totalAssetsEvaluated > 0
      ? (forecast.totalForecastedAssets / forecast.totalAssetsEvaluated) * 100
      : 0;

  const handleViewForecastAssets = () => {
    navigate("/assets?replacementRecommended=true");
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Replacement Forecast
          </h2>
          <p className="text-sm text-gray-500">
            Estimated future capital needs based on lifecycle age and benchmark
            replacement values.
          </p>
        </div>

        <button
          type="button"
          onClick={handleViewForecastAssets}
          className="w-fit rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          View Forecast Assets
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <SummaryTile
          label="Forecasted Assets"
          value={`${forecast.totalForecastedAssets} of ${forecast.totalAssetsEvaluated}`}
          helper={`${coveragePercent.toFixed(1)}% forecast coverage`}
        />

        <SummaryTile
          label="Total Capital Need"
          value={formatCurrency(forecast.totalEstimatedCapitalNeed)}
          helper="Estimated replacement value"
        />

        <SummaryTile
          label="Forecast Years"
          value={String(forecast.forecastYears.length)}
          helper="Years with projected replacements"
        />
      </div>

      <div className="space-y-3">
        {forecast.forecastYears.map((year) => (
          <ForecastYearRow
            key={year.year}
            year={year}
            onViewAssets={() => {
              navigate(`/assets?replacementRecommended=true`);
            }}
          />
        ))}
      </div>
    </section>
  );
};

const SummaryTile = ({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
    <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
      {label}
    </div>
    <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
    {helper && <div className="mt-1 text-xs text-gray-500">{helper}</div>}
  </div>
);

const ForecastYearRow = ({
  year,
  onViewAssets,
}: {
  year: ForecastYear;
  onViewAssets: () => void;
}) => (
  <div className="rounded-lg border border-gray-200 p-3">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-gray-500">
          Replacement Year
        </div>
        <div className="text-2xl font-semibold text-gray-900">
          {year.year}
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-gray-500">Assets</div>
        <div className="text-xl font-semibold text-gray-900">
          {year.assetCount}
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-gray-500">
          Estimated Capital Need
        </div>
        <div className="text-xl font-semibold text-gray-900">
          {formatCurrency(year.estimatedCapitalNeed)}
        </div>
      </div>

      <button
        type="button"
        onClick={onViewAssets}
        className="w-fit rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        View Assets
      </button>
    </div>

    {year.assets.length > 0 && (
      <div className="mt-3 border-t pt-3">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
          Example Assets
        </div>

        <div className="space-y-2">
          {year.assets.slice(0, 3).map((asset) => (
            <div
              key={asset._id}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 text-sm"
            >
              <span className="font-medium text-gray-900">
                {asset.ctrlNumber}
              </span>
              <span className="text-gray-600">
                {asset.manufacturer} {asset.model}
              </span>
              <span className="text-gray-700">
                {formatCurrency(asset.estimatedReplacementCost)}
              </span>
            </div>
          ))}

          {year.assets.length > 3 && (
            <div className="text-xs text-gray-500">
              +{year.assets.length - 3} more assets
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);

export default ReplacementForecastCard;