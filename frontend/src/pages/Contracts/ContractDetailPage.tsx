import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import { formatDate } from '../../utils/DashboardUtils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell
} from 'recharts';


const ContractDetailPage: React.FC = () => {
  const { contractId } = useParams();
  const [contract, setContract] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const res = await apiClient.get(`/contracts/${contractId}`);
      const contractData = res.data.contract ?? res.data;

      setContract(contractData);

      try {
        const { data: analysisData } = await apiClient.get(`/contract-analysis/${contractId}/year/2024`);
        setAnalysis(analysisData.analysis);
      } catch {
        setAnalysis(null); // If not found
      }
    };

    fetchData();
  }, [contractId]);

  if (!contract || !contract.startDate) return <div className="p-6">Loading contract...</div>;
  //console.log("Labor Cost", analysis?.totalLaborCost, "Parts Cost", analysis?.totalPartsCost);


  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{contract.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p><strong>Type:</strong> {contract.type}</p>
          <p><strong>Start Date:</strong> {contract.startDate ? formatDate(contract.startDate) : '—'}</p>
          <p><strong>Start Date:</strong> {contract.endDate ? formatDate(contract.endDate) : '—'}</p>
          <p><strong>Total Value:</strong> ${contract.totalValue?.toLocaleString?.() || 'N/A'}</p>
        </div>

        {contract.linkedVendor && (
          <div>
            <h2 className="text-lg font-semibold">Vendor</h2>
            <p>{contract.linkedVendor.name}</p>
            <p>{contract.linkedVendor.contactInfo?.email}</p>
          </div>
        )}
        {contract.linkedCustomer && (
          <div>
            <h2 className="text-lg font-semibold">Customer</h2>
            <p>{contract.linkedCustomer.name}</p>
            <p>{contract.linkedCustomer.contactPerson?.email}</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mt-6">Covered Assets</h2>
        <ul className="list-disc ml-6">
          {contract.coveredAssets?.map((asset: any) => (
            <li key={asset._id}>{asset.ctrlNumber} – {asset.manufacturer} {asset.model}</li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-semibold mt-6">Amendments</h2>
        <ul className="list-disc ml-6">
          {contract.amendments?.length > 0 ? (
            contract.amendments.map((a: any, index: number) => (
              <li key={index}>
                <strong>{a.changeType.toUpperCase()}</strong> – {a.description} ({new Date(a.date).toLocaleDateString()})
              </li>
            ))
          ) : (
            <p>No amendments recorded.</p>
          )}
        </ul>
      </div>

      {analysis ? (
        <>
          {/* Summary */}
          <div className="mt-6">
            <h2 className="text-xl font-semibold">2024 Analysis</h2>
            <p><strong>Total Parts Cost:</strong> ${analysis.totalPartsCost?.toLocaleString?.() ?? 'N/A'}</p>
            <p><strong>Total Labor Hours:</strong> {analysis.totalLaborHours ?? 'N/A'}</p>
            <p><strong>Total Labor Cost:</strong> ${analysis.totalLaborCost.toLocaleString()}</p>
            <p><strong>Estimated In-House Cost:</strong> ${analysis.estimatedInHouseCost?.toLocaleString?.() ?? 'N/A'}</p>
            <p><strong>Net Gain/Loss:</strong> ${analysis.netGainLoss?.toLocaleString?.() ?? 'N/A'}</p>
            <p><strong>Rating:</strong> {analysis.performanceRating ?? 'N/A'}</p>
          </div>

          {/* Bar Chart */}
          <div className="mt-10">
            <h2 className="text-xl font-semibold mb-2">Contract Cost Analysis (2024)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                {
                  name: '2024',
                  'Contract Value': analysis.contractValue,
                  'In-House Cost': analysis.estimatedInHouseCost,
                  'Net Gain/Loss': analysis.netGainLoss,
                }
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Contract Value" fill="#4CAF50" />
                <Bar dataKey="In-House Cost" fill="#2196F3" />
                <Bar dataKey="Net Gain/Loss" fill={analysis.netGainLoss >= 0 ? "#00C49F" : "#FF5722"} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          {(typeof analysis.totalLaborCost === 'number' && typeof analysis.totalPartsCost === 'number') ? (
            <div className="my-6">
              <h3 className="text-lg font-semibold mb-2">Cost Breakdown</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Labor", value: analysis.totalLaborCost },
                      { name: "Parts", value: analysis.totalPartsCost },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    <Cell fill="#8884d8" />
                    <Cell fill="#82ca9d" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-500">No cost analysis data available.</p>
          )}
        </>
      ) : (
        <p className="text-gray-500">No analysis data available.</p>
      )}
    </div>
  );
};

export default ContractDetailPage;