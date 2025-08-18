import React, { useEffect, useState } from 'react';
import apiClient from '../../../services/apiClient';
import AssetSelector from '../../../components/AssetSelector';

interface AddContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface Asset {
  _id: string;
  ctrlNumber: string;
  manufacturer: string;
  model: string;
}

const AddContractModal: React.FC<AddContractModalProps> = ({ isOpen, onClose, onSave }) => {
  const [vendors, setVendors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showAllAssets, setShowAllAssets] = useState(false);
  const [formData, setFormData] = useState<any>({
    name: '',
    type: 'vendor',
    linkedVendor: '',
    linkedCustomer: '',
    coveredAssets: [],
    startDate: '',
    endDate: '',
    totalValue: '',
    status: 'active',
    notes: ''
  });

  const maxVisible = 2;

  useEffect(() => {
    if (!isOpen) return;
    const loadDropdowns = async () => {
      const [v, c] = await Promise.all([
        apiClient.get('/vendors'),
        apiClient.get('/customers'),
      ]);
      setVendors(v.data);
      setCustomers(c.data);
    };
    if (formData.coveredAssets.length > 0) {
          apiClient
            .get('/assets', { params: { limit: 1000 } }) // or create a smarter fetchSelectedAssets() later
            .then(res => setAssets(res.data.assets || res.data));
    }

    loadDropdowns();
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  /*const handleAssetSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
    setFormData((prev: any) => ({ ...prev, coveredAssets: selected }));
  };*/

  const handleSubmit = async () => {
    try {
      await apiClient.post('/contracts', formData);
      onSave(); // refresh list
      onClose(); // close modal
    } catch (err) {
      console.error('Error creating contract:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-2xl">
        <h2 className="text-xl font-semibold mb-4">Add New Contract</h2>

        <div className="grid grid-cols-2 gap-4">
          <input type="text" name="name" placeholder="Contract Name" value={formData.name} onChange={handleChange} className="border px-2 py-1 rounded" />

          <select name="type" value={formData.type} onChange={handleChange} className="border px-2 py-1 rounded">
            <option value="vendor">Vendor</option>
            <option value="customer">Customer</option>
          </select>

          {formData.type === 'vendor' && (
            <select name="linkedVendor" value={formData.linkedVendor} onChange={handleChange} className="border px-2 py-1 rounded col-span-2">
              <option value="">Select Vendor</option>
              {vendors.map((v: any) => (
                <option key={v._id} value={v._id}>{v.name}</option>
              ))}
            </select>
          )}

          {formData.type === 'customer' && (
            <select name="linkedCustomer" value={formData.linkedCustomer} onChange={handleChange} className="border px-2 py-1 rounded col-span-2">
              <option value="">Select Customer</option>
              {customers.map((c: any) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          )}

          <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className="border px-2 py-1 rounded" />
          <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} className="border px-2 py-1 rounded" />
          <input type="number" name="totalValue" placeholder="Total Value" value={formData.totalValue} onChange={handleChange} className="border px-2 py-1 rounded" />
          
          <select name="status" value={formData.status} onChange={handleChange} className="border px-2 py-1 rounded">
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        <label className="block mt-4 font-semibold">Covered Assets</label>
        <div className='max -h-64 overflow-y-auto border rounded mb-2'>
            <AssetSelector
                selected={formData.coveredAssets}
                onChange={(ids) =>
                    setFormData((prev: any) => ({ ...prev, coveredAssets: ids }))
                }
            />
        </div>

        {formData.coveredAssets.length > 0 && (
        <div className="max-h-48 overflow-y-auto border rounded p-2 bg-gray-50">
            {/*<h3 className="font-semibold mb-2 text-sm text-gray-700">Selected Assets:</h3>*/}
            <h3 className="text-sm font-semibold mb-1">Selected Assets ({formData.coveredAssets.length})</h3>
            <ul className="space-y-1 text-sm">

            {formData.coveredAssets.map((assetId: string) => {
                const asset = assets.find((a: any) => a._id === assetId);
                return (
                <li key={assetId} className="flex justify-between items-center bg-white border p-2 rounded shadow-sm">
                    <span>
                    {asset?.ctrlNumber ?? assetId} – {asset?.manufacturer ?? ''} {asset?.model ?? ''}
                    </span>
                    <button
                    onClick={() =>
                        setFormData((prev: any) => ({
                        ...prev,
                        coveredAssets: prev.coveredAssets.filter((id: string) => id !== assetId),
                        }))
                    }
                    className="text-red-500 hover:text-red-700 text-xs"
                    >
                    ✕ Remove
                    </button>
                </li>
                );
            })}
            </ul>
        </div>
        )}

        <textarea name="notes" placeholder="Notes" value={formData.notes} onChange={handleChange} className="w-full border rounded px-2 py-1 mt-4" rows={3} />

        <div className="flex justify-end mt-6 gap-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Create Contract</button>
        </div>
      </div>
    </div>
  );
};

export default AddContractModal;