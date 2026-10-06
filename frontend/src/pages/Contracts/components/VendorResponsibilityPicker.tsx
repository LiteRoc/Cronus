export type ResponsibilityAsset = {
  _id: string;
  ctrlNumber?: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
};
export function contractResponsibilityOptions(assets: ResponsibilityAsset[], coverage: string[]) {
  const members = new Set(coverage),
    seen = new Set<string>();
  return assets.filter(asset => {
    if (!members.has(asset._id) || seen.has(asset._id)) return false;
    seen.add(asset._id);
    return true;
  });
}
export default function VendorResponsibilityPicker({
  assets,
  coverage,
  selected,
  onChange
}: {
  assets: ResponsibilityAsset[];
  coverage: string[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const options = contractResponsibilityOptions(assets, coverage);
  const members = new Set(coverage),
    available = new Set(options.map(asset => asset._id));
  const unavailable = [...new Set(selected)].filter(id => !available.has(id));
  return <div>
    <p className="text-sm text-gray-500">Vendor responsibility can cover only current Contract members.</p>
    <div className="mt-2 max-h-56 overflow-auto border rounded p-3 space-y-2">
      {options.map(asset => <label key={asset._id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(asset._id)} onChange={event => onChange(event.target.checked ? [...new Set([...selected, asset._id])] : selected.filter(id => id !== asset._id))} /><span>{asset.ctrlNumber || asset.serialNumber || `${asset.manufacturer ?? ''} ${asset.model ?? ''}`.trim() || 'Asset'}</span></label>)}
      {!options.length && <p>No current Contract Assets available.</p>}
      {unavailable.map(id => <div key={id} role="alert" className="text-amber-800 text-sm">{members.has(id) ? 'Assigned Asset is unavailable for selection' : 'Assignment is outside current Contract coverage'}: {id}. Retained until explicitly removed. <button type="button" onClick={() => onChange(selected.filter(item => item !== id))}>Remove assignment</button></div>)}
    </div>
  </div>;
}
