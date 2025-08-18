import axios from "axios";

const apiClient = axios.create({
  baseURL: "http://localhost:4000/",
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Interceptor to inject Authorization header
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token"); // or sessionStorage if you use that
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default apiClient;