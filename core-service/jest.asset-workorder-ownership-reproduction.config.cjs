// Gitea #6 opt-in evidence; production and previous regression suites stay unchanged.
module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['**/assetWorkOrderOwnership.reproduction.mjs', '**/assetOwnershipAlternateCreation.reproduction.mjs'],
};
