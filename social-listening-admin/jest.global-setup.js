require('dotenv').config();

/**
 * Loads the real, local, gitignored .env (see .env.example) into process.env before the
 * contract suite runs — same convention social-listening-core's own jest.global-setup.js
 * already uses. Story 6.1's own contract needs real ENTRA_ and SESSION_SECRET values to
 * exercise the real Entra External ID tenant, not a mock.
 */
module.exports = async function globalSetup() {};
