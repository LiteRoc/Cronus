// Opt-in Gitea #13 evidence. SECURITY assertions intentionally fail before remediation.
module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['**/supplierAuth.reproduction.mjs'],
  transform: {},
};
