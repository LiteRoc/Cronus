// Opt-in S3 evidence: SECURITY assertions intentionally fail before remediation.
module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['**/sharedResourceArchive.reproduction.mjs'],
};
