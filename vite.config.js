import { defineConfig } from 'vite';

export default defineConfig({
  // Lazily imported deps (PDF export, schema validation) are pre-bundled at dev-server start;
  // otherwise Vite discovers them on first use and reloads the page mid-action.
  optimizeDeps: {
    include: ['pdf-lib', 'ajv/dist/2020.js', 'ajv-formats'],
  },
});
