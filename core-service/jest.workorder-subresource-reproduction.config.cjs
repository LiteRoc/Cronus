// Gitea #5 opt-in evidence; unchanged production routers and existing module bridge.
module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['**/workOrderSubresourceOwnership.reproduction.mjs'],
};
