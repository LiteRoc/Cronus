import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, test, expect } from 'vitest';
import Page from './FilteredAssetPage';
const mocks = vi.hoisted(() => ({
  coverage: {
    eligiblePopulation: 100,
    freshEvaluated: 92,
    stale: 5,
    missing: 2,
    unsupported: 1,
    insufficientData: 3,
    isComplete: false
  }
}));
vi.mock('@/hooks/useAssets', () => ({
  useAssets: () => ({
    assets: [],
    totalPages: 1,
    totalCount: 0,
    pagination: {
      page: 1,
      pageSize: 10
    },
    setPagination: vi.fn(),
    refresh: vi.fn(),
    isLoading: false,
    error: null,
    lifecycleFilterCoverage: mocks.coverage
  })
}));
vi.mock('@/hooks/useFilteredStore', () => ({
  useFilteredStore: () => ({
    setFilters: vi.fn()
  })
}));
vi.mock('./components/FilteredAssetControls', () => ({
  default: () => null
}));
vi.mock('./components/AssetTable', () => ({
  default: () => null
}));
vi.mock('../AddAsset/modals/CreateAssetModal', () => ({
  default: () => null
}));
vi.mock('@/components/Pagination', () => ({
  default: () => null
}));
test('Asset filters display incomplete freshness coverage and insufficient evidence', () => {
  render(<MemoryRouter><Page /></MemoryRouter>);
  expect(screen.getByRole('status')).toHaveTextContent('92 of 100 Assets have current lifecycle assessments');
  expect(screen.getByRole('status')).toHaveTextContent('exclude 8 stale/unavailable Assets');
  expect(screen.getByRole('status')).toHaveTextContent('3 current assessments have insufficient');
  expect(screen.getByRole('status')).toHaveTextContent('Partial lifecycle filter coverage');
});
test('zero fresh coverage is not exhaustive no-match certainty', () => {
  mocks.coverage = {
    eligiblePopulation: 1,
    freshEvaluated: 0,
    stale: 1,
    missing: 0,
    unsupported: 0,
    insufficientData: 0,
    isComplete: false
  };
  render(<MemoryRouter><Page /></MemoryRouter>);
  expect(screen.getByRole('status')).toHaveTextContent('0 of 1');
  expect(screen.getByRole('status')).toHaveTextContent('Partial');
});
