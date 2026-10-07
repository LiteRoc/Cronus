import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { test, expect } from 'vitest';
import Card from './ReplacementForecastCard';
import type { ReplacementForecastResponse } from '@/types/Dashboard';
import type { LifecycleMoneyAggregate } from '@/types/LifecycleAggregation';
const capital = (): LifecycleMoneyAggregate => ({
  currency: 'USD',
  knownSubtotal: 100,
  total: null,
  isComplete: false,
  populationAssetCount: 1,
  valuedAssetCount: 1,
  missingAssetCount: 0,
  unresolvedAssetCount: 0,
  currencyUnknownAssetCount: 0,
  currencyGroups: [{
    currency: 'USD',
    knownSubtotal: 100,
    valuedAssetCount: 1
  }],
  unidentifiedCurrencyValues: [],
  missing: []
});
function data(): ReplacementForecastResponse {
  return {
    schemaVersion: 'lifecycle-forecast-v2',
    asOf: '2026-10-07',
    lifecycleCoverage: {
      eligiblePopulation: 2,
      freshEvaluated: 1,
      stale: 1,
      missing: 0,
      unsupported: 0,
      isComplete: false
    },
    isComplete: false,
    projectionUnavailableCount: 0,
    totalForecastedAssets: 1,
    totalAssetsEvaluated: 2,
    totalEstimatedCapitalNeed: null,
    capital: capital(),
    forecastYears: [{
      year: 2027,
      assetCount: 1,
      estimatedCapitalNeed: null,
      capital: capital(),
      assets: [{
        _id: 'A',
        ctrlNumber: 'SYN',
        manufacturer: 'Synthetic',
        model: 'Pump',
        estimatedReplacementCost: 100,
        currency: 'USD',
        replacementAssessmentState: 'not_recommended'
      }]
    }]
  };
}
const show = (d = data()) => render(<MemoryRouter><Card forecast={d} /></MemoryRouter>);
test('forecast discloses partial coverage and capital subtotal', () => {
  show();
  expect(screen.getByRole('status')).toHaveTextContent('1 of 2');
  expect(screen.getByRole('status')).toHaveTextContent('stale: 1');
  expect(screen.getByRole('status')).toHaveTextContent('Partial forecast');
  expect(screen.getAllByText('Known subtotal: $100.00')).toHaveLength(2);
  expect(screen.queryByText('Total: $100.00')).toBeNull();
});
test('unknown age or no fresh assessments shows partial coverage even with empty chart', () => {
  const d = data();
  d.forecastYears = [];
  d.totalForecastedAssets = 0;
  d.projectionUnavailableCount = 1;
  show(d);
  expect(screen.getByRole('status')).toHaveTextContent('Partial');
  expect(screen.getByText(/No current assessments have sufficient adopted lifecycle evidence/)).toBeVisible();
  expect(screen.getByText(/without projection evidence: 1/)).toBeVisible();
});
test('complete forecast explicitly labeled complete', () => {
  const d = data();
  d.isComplete = true;
  d.lifecycleCoverage = {
    eligiblePopulation: 1,
    freshEvaluated: 1,
    stale: 0,
    missing: 0,
    unsupported: 0,
    isComplete: true
  };
  d.capital.isComplete = true;
  d.capital.total = 100;
  show(d);
  expect(screen.getByRole('status')).toHaveTextContent('Complete forecast');
  expect(screen.getByText('Total: $100.00')).toBeVisible();
});
test('forecast drilldown uses exact current forecast members', () => {
  show();
  expect(screen.getByRole('link', {
    name: /SYN/
  })).toHaveAttribute('href', '/assets/edit/A');
  expect(screen.queryByRole('link', {
    name: 'View Forecast Assets'
  })).toBeNull();
});
test('legacy response cannot masquerade as canonical forecast', () => {
  render(<Card forecast={{
    forecastYears: []
  } as unknown as ReplacementForecastResponse} />);
  expect(screen.getByText('Current lifecycle forecast unavailable.')).toBeVisible();
});
test('loading and failure remain explicit', () => {
  const r = render(<Card isLoading />);
  expect(screen.getByText(/Loading replacement forecast/)).toBeVisible();
  r.rerender(<Card error="synthetic" />);
  expect(screen.getByText(/Unable to load/)).toBeVisible();
});
