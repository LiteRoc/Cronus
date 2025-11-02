import apiClient from "./apiClient";

export const fetchDashboardData = async () => {
  const response = await apiClient.get("/dashboard");
  return response.data;
};
