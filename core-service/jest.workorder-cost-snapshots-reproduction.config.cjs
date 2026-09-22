// Frozen Gitea #7 observations, opt-in only; not future-policy assertions.
module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['**/workOrderCostSnapshots.reproduction.mjs'],
};
