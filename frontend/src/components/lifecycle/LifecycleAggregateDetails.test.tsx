import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import TemplateCard from '@/pages/EditTemplates/components/TemplateLifecycleSummaryCard';
import ContractCard from '@/pages/Contracts/components/ContractLifecycleIntelligenceCard';
import Details, { CapitalAggregate } from './LifecycleAggregateDetails';
import type { LifecycleAggregation, LifecycleMoneyAggregate } from '@/types/LifecycleAggregation';
import type { TemplateLifecycleSummaryResponse } from '@/types/EquipmentTemplate';
import type { ContractLifecycleIntelligenceResponse } from '@/types/ContractLifecycle';
function capital(): LifecycleMoneyAggregate {
  return {
    currency: 'USD',
    knownSubtotal: 100000,
    total: null,
    isComplete: false,
    populationAssetCount: 2,
    valuedAssetCount: 1,
    missingAssetCount: 1,
    unresolvedAssetCount: 1,
    currencyUnknownAssetCount: 0,
    currencyGroups: [{
      currency: 'USD',
      knownSubtotal: 100000,
      valuedAssetCount: 1
    }],
    unidentifiedCurrencyValues: [],
    missing: [{
      assetId: 'B',
      reason: 'value_unknown'
    }]
  };
}
function data(): LifecycleAggregation {
  return {
    schemaVersion: 'lifecycle-aggregate-v1',
    asOf: '2026-10-07T00:00:00Z',
    versions: {},
    population: {
      populationAssetCount: 2,
      assessedAssetCount: 1,
      unavailableAssessmentCount: 1,
      pendingAssetCount: 3
    },
    capital: {
      replacementValue: capital(),
      estimatedDepreciatedValue: capital(),
      accountingBookValue: capital()
    },
    replacementReview: {
      populationAssetCount: 2,
      recommendedCount: 0,
      notRecommendedCount: 0,
      insufficientDataCount: 1,
      unavailableAssessmentCount: 1,
      evaluatedCount: 0,
      recommendedPercentOfPopulation: 0,
      recommendedPercentOfEvaluated: null
    },
    age: {
      stateCounts: {
        resolved: 0,
        estimated: 0,
        unknown: 1,
        invalid: 0,
        not_started: 0,
        unavailable: 1
      },
      buckets: [{
        key: '0-3',
        label: '0–<3 years',
        minInclusive: 0,
        maxExclusive: 3,
        count: 0
      }]
    },
    maintenance: {
      primaryScope: 'directMaintenance',
      window: {
        type: 'rolling',
        durationDays: 365,
        start: '2025-10-07',
        end: '2026-10-07',
        startInclusive: true,
        endInclusive: true,
        dateField: 'completionDate',
        statuses: ['Completed']
      },
      directMaintenance: {
        knownSubtotal: 60,
        total: null,
        isComplete: false,
        currency: 'USD',
        completeAssetCount: 1,
        incompleteAssetCount: 1,
        missingComponents: [{
          assetId: 'B',
          component: 'internalTravel'
        }],
        valuationBases: ['documented'],
        workOrders: {
          knownCount: 2,
          knownFullyPricedCount: 1,
          isComplete: false
        },
        statistics: {
          fleetMean: null,
          completeRecordSampleMean: 10,
          completeRecordSampleMedian: 10,
          sampleAssetCount: 1,
          populationAssetCount: 2
        }
      }
    },
    members: [{
      assetId: 'A',
      asset: {
        ctrlNumber: 'SYN-A'
      },
      replacementAssessment: null,
      reason: 'service_age_unknown'
    }, {
      assetId: 'B',
      asset: null,
      replacementAssessment: null,
      reason: 'asset_unavailable'
    }],
    deprecatedAliases: {}
  };
}
const show = (d = data()) => render(<MemoryRouter><Details data={d} /></MemoryRouter>);
test('partial replacement and depreciation show known subtotal, not total', () => {
  show();
  expect(screen.getAllByText('Known subtotal: $100,000.00')).toHaveLength(3);
  expect(screen.queryByText('Total: $100,000.00')).toBeNull();
  expect(screen.getAllByText(/Incomplete: 1 Assets missing/)).toHaveLength(3);
  expect(screen.queryByText('Current Book Value')).toBeNull();
});
test('incomplete direct maintenance and sample mean are explicit', () => {
  show();
  expect(screen.getByText('Direct Maintenance Cost — Last 365 Days')).toBeVisible();
  expect(screen.getByText('Known subtotal: $60.00')).toBeVisible();
  expect(screen.getByText('Fleet mean: Unavailable')).toBeVisible();
  expect(screen.getByText('Complete-record sample mean: $10.00 (1 of 2 Assets)')).toBeVisible();
  expect(screen.queryByText(/Projected Annual/)).toBeNull();
  expect(screen.getByText(/Completed WorkOrders, completionDate/)).toBeVisible();
});
test('three states and unavailable kept distinct with denominators', () => {
  show();
  expect(screen.getByText(/insufficient data: 1; assessment unavailable: 1/)).toBeVisible();
  expect(screen.getByText(/Unavailable of evaluated Assets \(0\)/)).toBeVisible();
  expect(screen.queryByText('Within Expected Life')).toBeNull();
});
test('zero population percentages display unavailable, not zero percent', () => {
  const d = data();
  d.replacementReview.recommendedPercentOfPopulation = null;
  d.replacementReview.populationAssetCount = 0;
  show(d);
  expect(screen.getByText(/Recommended: Unavailable of population \(0\)/)).toBeVisible();
});
test('exact member drilldown links authorized hydrated Assets and retains unavailable references', () => {
  show();
  fireEvent.click(screen.getByRole('button', {
    name: 'View Assets (2)'
  }));
  const region = screen.getByRole('region', {
    name: 'Lifecycle members'
  });
  expect(within(region).getByRole('link', {
    name: /SYN-A/
  })).toHaveAttribute('href', '/assets/edit/A');
  expect(within(region).getByText('Asset B: unavailable')).toBeVisible();
  fireEvent.click(screen.getByRole('button', {
    name: 'View Replacement Review (0)'
  }));
  expect(screen.getByText('No Assets in this selection.')).toBeVisible();
});
test('mixed currencies display groups without fake combined total', () => {
  const v = capital();
  v.currency = null;
  v.knownSubtotal = null;
  v.currencyGroups.push({
    currency: 'EUR',
    knownSubtotal: 20,
    valuedAssetCount: 1
  });
  render(<CapitalAggregate label="Replacement" value={v} />);
  expect(screen.getByText('Multiple currencies; no combined total.')).toBeVisible();
  expect(screen.getByText(/EUR known subtotal/)).toBeVisible();
});
test('unknown currency stays labeled without dollar symbol', () => {
  const v = capital();
  v.currency = null;
  v.knownSubtotal = 100000;
  v.currencyUnknownAssetCount = 1;
  v.unidentifiedCurrencyValues = [{
    assetId: 'A',
    amount: 100000
  }];
  render(<CapitalAggregate label="Replacement" value={v} />);
  expect(screen.getByText('Known subtotal: 100,000 (currency unknown)')).toBeVisible();
  expect(screen.queryByText(/\$100,000/)).toBeNull();
});
test('complete known zero is a total', () => {
  const v = capital();
  v.isComplete = true;
  v.total = 0;
  render(<CapitalAggregate label="Replacement" value={v} />);
  expect(screen.getByText('Total: $0.00')).toBeVisible();
});
test('Template card reports operational cohort and Pending separately', () => {
  const d = {
    ...data()
  } as TemplateLifecycleSummaryResponse;
  render(<MemoryRouter><TemplateCard summary={d} /></MemoryRouter>);
  expect(screen.getByText(/2 Active \+ Inactive Assets/)).toHaveTextContent('Pending / commissioning: 3');
});
test('Contract card reports current membership and original annual value separately', () => {
  const d = {
    ...data(),
    contract: {
      totalValue: 250
    }
  } as ContractLifecycleIntelligenceResponse;
  render(<MemoryRouter><ContractCard lifecycle={d} /></MemoryRouter>);
  expect(screen.getByText(/Covered Assets: 2/)).toHaveTextContent('vendor responsibility does not expand membership');
  expect(screen.getByText('Original base annual value: $250.00')).toBeVisible();
});
for (const kind of ['template', 'contract']) test(`${kind} loading and error`, () => {
  const v = render(kind === 'template' ? <TemplateCard isLoading /> : <ContractCard isLoading />);
  expect(screen.getByText(/Loading/)).toBeVisible();
  v.rerender(kind === 'template' ? <TemplateCard error="synthetic" /> : <ContractCard error="synthetic" />);
  expect(screen.getByText(/Unable to load/)).toBeVisible();
});
test('mixed-version legacy payload renders unavailable without invented canonical facts', () => {
  const v = render(<TemplateCard summary={{
    summary: {
      totalAssets: 5
    }
  } as TemplateLifecycleSummaryResponse} />);
  expect(screen.getByText(/No lifecycle summary available/)).toBeVisible();
  v.rerender(<ContractCard lifecycle={{
    summary: {
      coveredAssetCount: 5
    }
  } as ContractLifecycleIntelligenceResponse} />);
  expect(screen.getByText(/No lifecycle intelligence available/)).toBeVisible();
});
