/** @type {import('next').NextConfig} */
const nextConfig = {
  // Opt-in only, never set outside a spawned test's own child-process env
  // (see contracts/epic-6/story-6.1... and story-6.7...'s own beforeAll).
  // Next's dev-server lock file lives at path.join(distDir, 'lock')
  // (node_modules/next/dist/server/lib/router-utils/setup-dev-bundler.js) —
  // keyed by distDir, not by port. Two contract tests each spawning a real
  // `next dev` from this same project directory would otherwise race for
  // that one lock file whenever Jest schedules them onto concurrent
  // workers, even though they listen on different ports. Nested under
  // `.next/` so the existing `.next/` .gitignore entry already covers it.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

module.exports = nextConfig;
