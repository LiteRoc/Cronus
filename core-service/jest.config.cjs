module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/_tests_/**/*.test.mjs', '**/__tests__/**/*.test.mjs'],
  // Operational routers bridge four existing ESM helpers into CommonJS.
  transform: {
    '/src/(middleware/forwardContractHeaders|services/lifecycleMaintenance|services/templateLifecycleBenchmarks|utils/lifecycleBenchmark)\\.js$':
      '<rootDir>/src/test/facilityReproductionTransform.cjs',
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1.js',
  },
};
