import axios from 'axios';

const API = axios.create({
  baseURL: "http://localhost:4000/", // Backend API URL
  headers: {
    "Content-Type": "application/json",
  },
});

export const getContractsWithAnalysis = async () => {
  const res = await API.get('/contracts');
  const contracts = Array.isArray(res.data) ? res.data : res.data.contracts || [];

  const results = await Promise.all(
    contracts.map(async (c: any) => {
      try {
        const { data } = await API.get(`/contract-analysis/${c._id}/year/2024`);
        return {
          ...c,
          performanceRating: data.analysis?.performanceRating,
          netGainLoss: data.analysis?.netGainLoss,
        };
      } catch {
        return c;
      }
    })
  );

  return results;
};

export const getContractById = async (id: string) => {
  const { data } = await API.get(`/contracts/${id}`);
  return data;
};

export default API;
