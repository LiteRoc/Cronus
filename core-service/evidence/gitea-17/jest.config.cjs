const base = require('../../jest.config.cjs');
module.exports = { ...base, rootDir: '../..', testMatch: ['<rootDir>/evidence/gitea-17/reproduction.mjs'] };
