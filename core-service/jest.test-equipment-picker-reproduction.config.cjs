// Opt-in S2 evidence; SECURITY assertions intentionally fail before remediation.
module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['**/testEquipmentPicker.reproduction.mjs'],
};
