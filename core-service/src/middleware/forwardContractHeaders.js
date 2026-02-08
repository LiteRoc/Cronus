//src/middleware/forwardContractHeaders.js

import axios from 'axios';

export function attachContractClient(req, _res, next) {
    const token = req.headers.authorization || '';
    const facilityId = req.headers['x-facility-id'] || '';

    req.contract = axios.create({
        baseURL: process.env.CONTRACT_API_URL || 'http://contract-service:5001',
        headers: {
            Authorization: token,
            'x-facility-id': facilityId,
            'Content-Type': 'application/json',
        },
    });

    next();
}