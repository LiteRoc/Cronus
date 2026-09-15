// Gitea #3 only: preserve executable handlers while bridging their mixed module graph.
module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['**/facilityQueryIsolation.reproduction.mjs'],
  transform: {
    '/src/(middleware/forwardContractHeaders|services/lifecycleMaintenance|services/templateLifecycleBenchmarks|utils/lifecycleBenchmark)\\.js$':
      '<rootDir>/src/test/facilityReproductionTransform.cjs',
  },
};
