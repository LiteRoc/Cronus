// Opt-in Gitea #4 evidence; intentionally red security assertions.
module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['**/vendorAuthOwnership.reproduction.mjs'],
  transform: {},
};
