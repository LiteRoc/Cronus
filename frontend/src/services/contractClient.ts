// src/services/contractClient.ts

import axios from "axios";

const contractClient = axios.create({
  baseURL: import.meta.env.VITE_CONTRACT_API_URL || "http://localhost:5001",
  withCredentials: true,
});

// ⚡ Add auth + facility header injection (same as apiClient)
contractClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    const facilityId = localStorage.getItem("selectedFacilityId");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Only add facilityId if the request isn't for auth
    if (facilityId && !config.url?.includes("/auth")) {
      config.headers["x-facility-id"] = facilityId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default contractClient;