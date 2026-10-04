import { defineConfig, defaultClientConditions } from 'vite';

export default defineConfig({
  resolve: {
    // Use @gurps-sheet/character's TypeScript source (packages/character/src) instead of its built dist/,
    // so library edits show up live and a stale build can never be served.
    conditions: ['@gurps-sheet/source', ...defaultClientConditions],
  },
  // Lazily imported deps (PDF export, schema validation) are pre-bundled at dev-server start;
  // otherwise Vite discovers them on first use and reloads the page mid-action.
  optimizeDeps: {
    include: ['pdf-lib', 'ajv/dist/2020.js', 'ajv-formats'],
  },
});
