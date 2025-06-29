import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:4000/", // Backend API URL
  headers: {
    "Content-Type": "application/json",
  },
});

export const downloadWorkOrderPDF = async (
  workOrderNumber: string,
) => {
  const response = await API.get(`/reports/workorders/${workOrderNumber}/pdf`, { responseType: 'blob' });
  return response.data;
};

export default API;