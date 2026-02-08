//src/services/coreAPIClient.js

import axios from 'axios';

const coreAPIClient = axios.create({
    baseURL: process.env.CORE_API_URL || "http://localhost:4000",
    headers: { "Content-Type": "application/json" },
});

export const withForwardedHeaders = (req) => {
    const instance = coreAPIClient;
    instance.defaults.headers.common["Authorization"] = 
        req.headers.authorization || req.headers.Authorization || "";

    instance.defaults.headers.common["x-facility-id"] = 
        req.headers['x-facility-id'] || req.headers['X-Facility-Id'] || "";

    return instance;
};

export const makeCoreClient = (req) => {
  return axios.create({
    baseURL: process.env.CORE_API_URL || "http://localhost:4000",
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.authorization || req.headers.Authorization || "",
      "x-facility-id": req.headers["x-facility-id"] || req.headers["X-Facility-Id"] || "",
    },
  });
};


export default coreAPIClient;