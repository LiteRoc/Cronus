import apiClient from "./apiClient";

// Define the function to fetch dashboard data
export const fetchDashboardData = async (role?: string) => {
  try {
    const endpoint = role === 'customer'
      ? "/portal/dashboard/summary"
      : "/dashboard";
    const response = await apiClient.get(endpoint);
    return response.data;
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    throw error;
  }
};