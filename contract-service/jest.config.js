export default {
  testEnvironment: "node",
  testMatch: ["**/_tests_/**/*.test.js"],
  // Reuse the existing core test bridge for authenticated Asset API integration.
  transform: {
    '/core-service/src/(middleware/forwardContractHeaders|services/lifecycleMaintenance|services/templateLifecycleBenchmarks|utils/lifecycleBenchmark)\\.js$': '<rootDir>/../core-service/src/test/facilityReproductionTransform.cjs',
  },
  clearMocks: true
};