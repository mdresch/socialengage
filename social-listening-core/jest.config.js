/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/contracts/**/*.contract.test.ts', '**/src/**/*.test.ts'],
  globalSetup: '<rootDir>/jest.global-setup.js',
  globalTeardown: '<rootDir>/jest.global-teardown.js',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testSequencer: '<rootDir>/jest.sequencer.js',
};
