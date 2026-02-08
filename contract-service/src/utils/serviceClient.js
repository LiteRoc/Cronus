// src/utils/serviceClient.js

import axios from "axios";

const serviceClient = axios.create({
    // Don't hardcode the baseUrl unless limiting to one target
    headers: {
        'Content-Type': 'application/json',
    },
});

// Automatically attach service token and facilityId if provided
serviceClient.interceptors.request.use(
    (config) => {
    const serviceToken = process.env.SERVICE_AUTH_TOKEN;

    if (serviceToken) {
      config.headers.Authorization = `Bearer ${serviceToken}`;
    }

    // Optional: pass along x-facility-id if relevant
    if (config.headers['x-facility-id']) {
      config.headers['x-facility-id'] = config.headers['x-facility-id'];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default serviceClient;