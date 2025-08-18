import React, { useEffect, useState } from 'react';
import { getContractsWithAnalysis } from '../../services/contractAPI';
import { useNavigate } from 'react-router-dom';
import AddContractModal from './modals/AddContractModal';

interface Contract {
  _id: string;
  name: string;
  type: 'vendor' | 'customer';
  startDate: string;
  endDate: string;
  totalValue: number;
  performanceRating?: string;
  netGainLoss?: number;
}

const ContractTable: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchContracts = async () => {
      const data = await getContractsWithAnalysis();
      setContracts(data);
    };
    fetchContracts();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Contracts</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          + Add Contract
        </button>
      </div>

      <table className="min-w-full bg-white shadow rounded">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-3">Name</th>
            <th className="p-3">Type</th>
            <th className="p-3">Start → End</th>
            <th className="p-3">Value</th>
            <th className="p-3">Profitability</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract) => (
            <tr
              key={contract._id}
              className="border-t cursor-pointer hover:bg-gray-100"
              onClick={() => navigate(`/contracts/${contract._id}`)}
            >
              <td className="p-3 font-medium">{contract.name}</td>
              <td className="p-3 capitalize">{contract.type}</td>
              <td className="p-3">
                {new Date(contract.startDate).toLocaleDateString()} →{' '}
                {new Date(contract.endDate).toLocaleDateString()}
              </td>
              <td className="p-3">${contract.totalValue.toLocaleString()}</td>
              <td className="p-3">
                {contract.netGainLoss != null
                  ? `$${contract.netGainLoss.toLocaleString()} (${contract.performanceRating})`
                  : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <AddContractModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={() => {
          setIsModalOpen(false);
          // Refresh contract list
          getContractsWithAnalysis().then(setContracts);
        }}
      />

    </div>
  );
};

export default ContractTable;