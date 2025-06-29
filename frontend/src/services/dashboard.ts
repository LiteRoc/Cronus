import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:4000/", // Backend API URL
  headers: {
    "Content-Type": "application/json",
  },
});

// Define the function to fetch dashboard data
export const fetchDashboardData = async () => {
  try {
    const response = await API.get("/dashboard");
    return response.data;
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    throw error;
  }
};