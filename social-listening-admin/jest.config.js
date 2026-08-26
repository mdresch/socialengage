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
    // CSS modules (e.g. page.module.css) — stubbed via identity-obj-proxy so
    // Jest can import .tsx pages that use CSS modules without parsing the CSS
    // itself. Standard Next.js Jest setup pattern.
    '\\.module\\.css$': 'identity-obj-proxy',
  },
  // Story 6.19 — react-markdown and its whole unified/remark/mdast/micromark
  // dependency chain ship as ESM-only (`export {`), which Jest's default
  // node_modules-is-never-transformed rule can't parse. ts-jest already
  // transpiles this repo's own .ts/.tsx via tsconfig's allowJs+isolatedModules
  // (transpile-only, no type-checking) — reused here for the specific,
  // named ESM packages this dependency tree actually pulls in, not a blanket
  // "transform all of node_modules" (which would slow every test run down).
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-markdown|@ungap/structured-clone|bail|ccount|character-entities|character-entities-html4|character-entities-legacy|character-reference-invalid|comma-separated-tokens|decode-named-character-reference|dequal|devlop|estree-util-is-identifier-name|hast-util-to-jsx-runtime|hast-util-whitespace|html-url-attributes|inline-style-parser|is-alphabetical|is-alphanumerical|is-decimal|is-hexadecimal|is-plain-obj|longest-streak|mdast-util-from-markdown|mdast-util-mdx-expression|mdast-util-mdx-jsx|mdast-util-mdxjs-esm|mdast-util-phrasing|mdast-util-to-hast|mdast-util-to-markdown|mdast-util-to-string|micromark|micromark-core-commonmark|micromark-factory-destination|micromark-factory-label|micromark-factory-space|micromark-factory-title|micromark-factory-whitespace|micromark-util-character|micromark-util-chunked|micromark-util-classify-character|micromark-util-combine-extensions|micromark-util-decode-numeric-character-reference|micromark-util-decode-string|micromark-util-encode|micromark-util-html-tag-name|micromark-util-normalize-identifier|micromark-util-resolve-all|micromark-util-sanitize-uri|micromark-util-subtokenize|micromark-util-symbol|micromark-util-types|parse-entities|property-information|remark-parse|remark-rehype|space-separated-tokens|stringify-entities|style-to-js|style-to-object|trim-lines|trough|unified|unist-util-is|unist-util-position|unist-util-stringify-position|unist-util-visit|unist-util-visit-parents|vfile|vfile-message|zwitch)/)',
  ],
  globalSetup: '<rootDir>/jest.global-setup.js',
  // Story 6.1's own contract drives a real Next.js dev server + a real headless-browser
  // sign-in against the real Entra tenant — slower than this repo's other, purely
  // structural contracts.
  testTimeout: 120_000,
};
