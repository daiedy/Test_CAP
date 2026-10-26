// ESLint for the Fiori Elements app: SAP Fiori tools rules for production and test code.
// ui5lint covers UI5-specific checks (deprecated APIs, globals, CSP, manifest); this config
// covers JavaScript style and correctness so that controllers, extensions and OPA5 tests stay uniform.
import fioriTools from '@sap-ux/eslint-plugin-fiori-tools';
import jsdoc from 'eslint-plugin-jsdoc';

const jsdocRecommended = jsdoc.configs['flat/recommended'];

export default [
  { ignores: ['dist/**', 'node_modules/**', 'report/**', 'webapp/localService/**'] },
  ...fioriTools.configs.recommended,
  {
    // FLP sandbox bootstrap files must define window["sap-ushell-config"]; that is the ushell contract.
    files: ['webapp/sandboxConfig.js', 'webapp/test/flpSandboxConfig.js'],
    rules: { '@sap-ux/fiori-tools/sap-no-global-define': 'off' },
  },
  {
    // JSDoc gate (ADR-0029 decision 7): every function of the extension code carries a block.
    // The recommended set warns; the rules CONVENTIONS asks for are errors, which the SubagentStop
    // hook blocks on. Same rule list as the srv/ block of the root eslint.config.mjs except the
    // require-jsdoc contexts and no-undefined-types. Component.js, tests and sandbox files are out of scope.
    ...jsdocRecommended,
    files: ['webapp/ext/**/*.js'],
    rules: {
      ...jsdocRecommended.rules,
      'jsdoc/require-jsdoc': [
        'error',
        { require: { FunctionDeclaration: true, FunctionExpression: true, MethodDefinition: true } },
      ],
      'jsdoc/require-param': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns': 'error',
      'jsdoc/require-returns-description': 'error',
      'jsdoc/check-param-names': 'error',
      'jsdoc/tag-lines': ['warn', 'never', { startLines: null }],
      // UI5 namespace types (sap.m.Input, sap.ui.model.odata.v4.Context) are not resolvable by the plugin.
      'jsdoc/no-undefined-types': 'off',
    },
  },
];
