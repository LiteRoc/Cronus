import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
const state = vi.hoisted(() => ({
  overview: null as any,
  mutate: vi.fn(),
  add: vi.fn(),
  patch: vi.fn(),
  assets: vi.fn(),
  apply: vi.fn(),
  error: vi.fn()
}));
vi.mock('@/hooks/useContractOverview', () => ({
  useContractOverview: () => ({
    overview: state.overview,
    isLoading: false,
    isError: false,
    mutate: state.mutate
  })
}));
vi.mock('@/hooks/useFacilityAssetsForSelect', () => ({
  useFacilityAssetsForSelect: () => ({
    assets: [{
      _id: 'A',
      ctrlNumber: 'Member A'
    }, {
      _id: 'B',
      ctrlNumber: 'Nonmember B'
    }]
  })
}));
vi.mock('@/hooks/useContractValue', () => ({
  useContractValue: () => ({
    value: null,
    isLoading: false,
    isError: false
  })
}));
vi.mock('@/hooks/useVendors', () => ({
  useVendors: () => ({
    vendors: [{
      _id: 'V',
      name: 'Synthetic Vendor'
    }]
  })
}));
vi.mock('swr', () => ({
  default: () => ({
    data: null,
    isLoading: false,
    error: null
  })
}));
vi.mock('@/utils/toastUtils', () => ({
  showSuccess: vi.fn(),
  showError: state.error
}));
vi.mock('@/services/contractAPI', () => ({
  createDraftAmendment: vi.fn(),
  getContractLifecycleIntelligence: vi.fn(),
  previewApplyAmendment: vi.fn(),
  applyApprovedAmendment: state.apply,
  submitAmendment: vi.fn(),
  approveAmendment: vi.fn(),
  declineAmendment: vi.fn(),
  voidAmendment: vi.fn(),
  addVendorLink: state.add,
  updateVendorLink: state.patch,
  updateVendorLinkAssets: state.assets,
  getVendorLinkOverview: vi.fn()
}));
vi.mock('../components/ContractValuePanel', () => ({
  ContractValuePanel: () => null
}));
vi.mock('../components/ContractValueChart', () => ({
  ContractValueChart: () => null
}));
vi.mock('../components/ContractTimelineTable', () => ({
  ContractTimelineTable: () => null
}));
vi.mock('../components/ContractLifecycleIntelligenceCard', () => ({
  default: () => null
}));
import Page from './ContractDetailPage';
const renderPage = () => render(<MemoryRouter initialEntries={['/contracts/C']}><Routes><Route path="/contracts/:id" element={<Page />} /></Routes></MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks();
  state.overview = {
    contract: {
      _id: 'C',
      name: 'Synthetic Contract',
      type: 'customer',
      status: 'active',
      coveredAssets: ['A'],
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      totalValue: 1000,
      vendorLinks: [],
      amendments: []
    },
    assets: [{
      _id: 'A',
      ctrlNumber: 'Member A'
    }],
    workOrders: {
      totalYTD: 0,
      avgResponseTimeHours: 0,
      openCount: 0,
      closedCount: 0
    },
    pmSummary: {
      compliancePercent: 100,
      dueThisYear: 0,
      completedThisYear: 0,
      overdue: 0
    },
    parts: {
      totalUsed: 0,
      totalPartCost: 0
    },
    performance: {},
    risk: {
      score: 0,
      label: 'Good',
      reasons: []
    }
  };
  state.add.mockResolvedValue({});
  state.patch.mockResolvedValue({});
  state.assets.mockResolvedValue({});
});
test('Contract detail vendor modal does not offer unrelated Facility Asset', () => {
  renderPage();
  fireEvent.click(screen.getByRole('button', {
    name: 'Add Vendor Link'
  }));
  expect(screen.getByLabelText('Member A')).toBeInTheDocument();
  expect(screen.queryByLabelText('Nonmember B')).not.toBeInTheDocument();
});
test('Contract detail surfaces backend containment rejection', async () => {
  state.add.mockRejectedValue({
    response: {
      data: {
        error: 'Vendor responsibility must remain within current Contract coverage'
      }
    }
  });
  renderPage();
  fireEvent.click(screen.getByRole('button', {
    name: 'Add Vendor Link'
  }));
  const selects = screen.getAllByRole('combobox');
  fireEvent.change(selects[0], {
    target: {
      value: 'V'
    }
  });
  fireEvent.click(screen.getByRole('button', {
    name: 'Add Vendor'
  }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('within current Contract coverage'));
  expect(state.patch).not.toHaveBeenCalled();
});
test('explicit anomaly removal precedes commercial edit; no silent discard', async () => {
  state.overview.contract.vendorLinks = [{
    _id: 'L',
    vendorId: 'V',
    nameSnapshot: 'Synthetic Vendor',
    coverageType: 'full',
    annualCost: 0,
    coveredAssetIds: ['A', 'B'],
    coveredAssetsCount: 1,
    responsibility: {
      assetIds: ['A'],
      outOfCoverageAssetIds: ['B']
    }
  }];
  renderPage();
  expect(screen.getByText('Out-of-coverage assignments retained; review required.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {
    name: 'Edit'
  }));
  expect(state.assets).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {
    name: 'Remove assignment'
  }));
  fireEvent.click(screen.getByRole('button', {
    name: 'Save Changes'
  }));
  await waitFor(() => expect(state.patch).toHaveBeenCalled());
  expect(state.assets).toHaveBeenCalledWith('C', 'L', {
    add: [],
    remove: ['B']
  });
  expect(state.assets.mock.invocationCallOrder[0]).toBeLessThan(state.patch.mock.invocationCallOrder[0]);
});
test('amendment disposition conflict displayed without reporting success', async () => {
  state.overview.contract.amendments = [{
    amendmentNumber: 'C.1',
    status: 'approved',
    changeType: 'remove',
    date: '2026-01-01',
    items: []
  }];
  state.apply.mockRejectedValue({
    response: {
      data: {
        error: 'Coverage change requires explicit vendor responsibility disposition first'
      }
    }
  });
  renderPage();
  fireEvent.click(screen.getByRole('button', {
    name: 'Apply'
  }));
  await waitFor(() => expect(state.error).toHaveBeenCalledWith('Coverage change requires explicit vendor responsibility disposition first'));
});
