import { act, render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { beforeEach, expect, test, vi } from 'vitest';
import ContractProfitabilityPanel from './ContractProfitabilityPanel';

const state = vi.hoisted(() => ({ role: 'admin', facility: 'a', get: vi.fn() }));
vi.mock('../../../context/UserContext', () => ({ useUser: () => ({ user: { role: state.role, _id: 'actor' } }) }));
vi.mock('../../../context/FacilityContext', () => ({ useFacility: () => ({ selectedFacilityId: state.facility }) }));
vi.mock('../../../services/contractAPI', () => ({ getContractProfitability: state.get }));

const result = {
  asOf: '2026-07-01T00:00:00.000Z', revenue: { annual: 3650, ytd: 1800 }, vendorPayout: { ytd: 0 },
  economicScopes: { directMaintenance: { total: null, knownSubtotal: 90 } },
  internalCostToServe: { ytd_allAssets: null, leakage_onVendorAssets: null },
  net: { ytd: null, marginPct: null }, incompleteReason: 'incomplete_direct_cost', byVendor: [],
};
function panel(date = '2026-07-01') {
  return <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
    <ContractProfitabilityPanel contractId="contract" contractType="customer" financiallyLive asOf={date} />
  </SWRConfig>;
}
beforeEach(() => { state.role = 'admin'; state.facility = 'a'; state.get.mockReset(); });
test.each(['technician', 'customer'])('%s cannot see or request profitability', role => {
  state.role = role;
  render(panel());
  expect(screen.queryByRole('region')).toBeNull();
  expect(state.get).not.toHaveBeenCalled();
});
test('uses the requested facility and date and preserves zero, unknown and reconciled amounts', async () => {
  state.get.mockResolvedValue(result);
  const view = render(panel());
  expect(await screen.findByText('$1,800.00')).toBeInTheDocument();
  expect(state.get).toHaveBeenCalledWith('contract', '2026-07-01', 'a');
  expect(screen.getByText('$0.00')).toBeInTheDocument();
  expect(screen.getByText(/Known direct maintenance subtotal/)).toHaveTextContent('$90.00');
  expect(screen.getAllByText('Unknown').length).toBeGreaterThan(1);
  state.get.mockResolvedValue({ ...result, asOf: '2026-08-01', net: { ytd: 125, marginPct: 5.2 }, incompleteReason: null });
  view.rerender(panel('2026-08-01'));
  expect(await screen.findByText('$125.00')).toBeInTheDocument();
  expect(screen.getByText('5.2%')).toBeInTheDocument();
});
test('a failed facility switch hides old and late results', async () => {
  let resolve!: (v: typeof result) => void;
  state.get.mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockRejectedValueOnce(new Error('Unavailable'));
  const view = render(panel());
  state.facility = 'b'; view.rerender(panel());
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  await act(async () => resolve(result));
  expect(screen.queryByText('$1,800.00')).toBeNull();
});
