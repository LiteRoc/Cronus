//src/middleware/forwardCoreHeaders.js

import axios from 'axios';

/**
 * Middleware that injects Authorization + facility headers
 * into coreApiClient before each controller runs.
 */

export function attachCoreClient(req, _res, next) {
  const token = req.headers.authorization || '';
  const facilityId = req.headers['x-facility-id'] || '';

  req.core = axios.create({
    baseURL: process.env.CORE_API_URL || 'http://core-service:4000/', // or Docker internal host
    headers: {
      Authorization: token,
      'x-facility-id': facilityId,
      'Content-Type': 'application/json',
    },
  });

  next();
}