/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/contracts/**/*.contract.test.ts', '<rootDir>/src/**/*.test.ts'],
  // Story 6.2's own healing pass (2026-08-06) needs to import real .tsx page components
  // (tsconfig.json's own "@/*" -> "src/*" path alias) directly from a contract test, to
  // prove route-level redirect behavior rather than only unit-testing role-routing.ts.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  globalSetup: '<rootDir>/jest.global-setup.js',
  // Story 6.1's own contract drives a real Next.js dev server + a real headless-browser
  // sign-in against the real Entra tenant — slower than this repo's other, purely
  // structural contracts.
  testTimeout: 120_000,
};
