import cds from '@sap/cds/eslint.config.mjs';
import cdsPlugin from '@sap/eslint-plugin-cds';

export default [
  // The UI app has its own ESLint config (app/products/eslint.config.mjs) and its own node_modules.
  { ignores: ['app/**'] },
  ...cds.recommended,
  cdsPlugin.configs.recommended,
  {
    // CLI scripts of the pipeline talk to the terminal by design.
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
];
