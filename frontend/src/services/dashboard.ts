import { ReplacementForecastResponse } from "@/types";
import apiClient from "./apiClient";

export const fetchDashboardData = async () => {
  const response = await apiClient.get("/dashboard");
  return response.data;
};

export const getReplacementForecast = async (): Promise<ReplacementForecastResponse> => {
  const { data } = await apiClient.get("/dashboard/lifecycle/replacement-forecast");
  return data;
};