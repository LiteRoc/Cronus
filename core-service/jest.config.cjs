module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/_tests_/**/*.test.mjs', '**/__tests__/**/*.test.mjs'],
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1.js',
  },
};
