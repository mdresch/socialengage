/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/contracts/**/*.contract.test.ts', '<rootDir>/src/**/*.test.ts'],
  globalSetup: '<rootDir>/jest.global-setup.js',
  // Story 6.1's own contract drives a real Next.js dev server + a real headless-browser
  // sign-in against the real Entra tenant — slower than this repo's other, purely
  // structural contracts.
  testTimeout: 120_000,
};
