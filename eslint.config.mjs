import cds from '@sap/cds/eslint.config.mjs';
import cdsPlugin from '@sap/eslint-plugin-cds';

export default [
  ...cds.recommended,
  cdsPlugin.configs.recommended,
  {
    // CLI scripts of the pipeline talk to the terminal by design.
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
];
