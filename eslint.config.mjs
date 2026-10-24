import cds from '@sap/cds/eslint.config.mjs';
import cdsPlugin from '@sap/eslint-plugin-cds';
import jsdoc from 'eslint-plugin-jsdoc';

const jsdocRecommended = jsdoc.configs['flat/recommended'];

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
  {
    // JSDoc gate (ADR-0029 decision 7): exported functions and the handler class with its methods
    // carry a block. The recommended set warns; the rules CONVENTIONS asks for are errors, which the
    // SubagentStop hook blocks on. Same rule list as the webapp/ext block of
    // app/products/eslint.config.mjs except the require-jsdoc contexts and no-undefined-types.
    // Tests, templates and scripts/ are out of scope.
    ...jsdocRecommended,
    files: ['srv/**/*.js'],
    rules: {
      ...jsdocRecommended.rules,
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: { FunctionDeclaration: true, ClassDeclaration: true, MethodDefinition: true },
        },
      ],
      'jsdoc/require-param': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns': 'error',
      'jsdoc/require-returns-description': 'error',
      'jsdoc/check-param-names': 'error',
      'jsdoc/tag-lines': ['warn', 'never', { startLines: null }],
    },
  },
];
