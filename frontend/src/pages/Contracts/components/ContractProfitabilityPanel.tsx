import useSWR from 'swr';
import { useFacility } from '../../../context/FacilityContext';
import { useUser } from '../../../context/UserContext';
import { getContractProfitability } from '../../../services/contractAPI';
import { fmtMoney } from '../../../utils/format';

type Props = { contractId: string; contractType: string; financiallyLive: boolean; asOf: string };
const money = (value: number | null) => value === null ? 'Unknown' : fmtMoney(value);

export default function ContractProfitabilityPanel({ contractId, contractType, financiallyLive, asOf }: Props) {
  const { user } = useUser() ?? {};
  const { selectedFacilityId } = useFacility();
  const visible = user?.role === 'admin' && contractType === 'customer' && financiallyLive;
  const key = visible && selectedFacilityId && asOf
    ? ['contract-profitability', contractId, asOf, selectedFacilityId, user._id] as const : null;
  const { data, error } = useSWR(key, ([, id, date, facility]) => getContractProfitability(id, date, facility),
    { keepPreviousData: false });
  if (!visible) return null;

  const metrics = data && [
    ['Annual revenue', money(data.revenue.annual)],
    ['Revenue YTD', money(data.revenue.ytd)],
    ['Vendor payouts YTD', money(data.vendorPayout.ytd)],
    ['Internal cost YTD', money(data.internalCostToServe.ytd_allAssets)],
    ['Internal cost on vendor-covered assets', money(data.internalCostToServe.leakage_onVendorAssets)],
    ['Direct maintenance cost YTD', money(data.economicScopes.directMaintenance.total)],
    ['Net YTD', money(data.net.ytd)],
    ['Margin YTD', data.net.marginPct === null ? 'Unknown' : `${data.net.marginPct.toFixed(1)}%`],
  ];
  return <section className="rounded-xl border bg-white p-5 space-y-3" aria-label="Contract profitability">
    <h2 className="text-xl font-semibold">Contract profitability</h2>
    {!selectedFacilityId ? <p>Select a facility to view profitability.</p>
      : !asOf ? <p>Select a reporting date.</p>
      : error ? <p role="alert">Profitability is unavailable for this facility and date.</p>
      : !data || !metrics ? <p>Loading profitability...</p>
      : <>
        <p>As of {data.asOf.slice(0, 10)} (UTC)</p>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">{metrics.map(([label, value]) =>
          <div key={label}><dt className="text-sm text-gray-600">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
        {data.byVendor.map(vendor => <p key={vendor.linkId}>{vendor.nameSnapshot || 'Vendor'} payout YTD: {money(vendor.payoutYTD)}</p>)}
        {data.economicScopes.directMaintenance.total === null &&
          <p>Known direct maintenance subtotal: {money(data.economicScopes.directMaintenance.knownSubtotal)}</p>}
        {data.incompleteReason === 'vendor_payout_attribution_unreconciled' &&
          <p>Net and margin are unavailable until vendor payouts and direct costs are reconciled.</p>}
        {data.incompleteReason === 'incomplete_direct_cost' && <p>Net and margin are unavailable because direct costs are incomplete.</p>}
      </>}
  </section>;
}
