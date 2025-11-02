import axios from "axios";

const apiClient = axios.create({
  baseURL: "http://localhost:4000/",
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Interceptor to inject Authorization header + facility header to every request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    const facilityId = localStorage.getItem('selectedFacilityId');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Only add facilityId if not hitting auth endpoints
    if (facilityId && !config.url?.includes('/auth/')) {
      config.headers['x-facility-id'] = facilityId;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

export default apiClient;