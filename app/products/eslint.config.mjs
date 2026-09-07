// ESLint for the Fiori Elements app: SAP Fiori tools rules for production and test code.
// ui5lint covers UI5-specific checks (deprecated APIs, globals, CSP, manifest); this config
// covers JavaScript style and correctness so that controllers, extensions and OPA5 tests stay uniform.
import fioriTools from '@sap-ux/eslint-plugin-fiori-tools';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'report/**', 'webapp/localService/**'] },
  ...fioriTools.configs.recommended,
  {
    // FLP sandbox bootstrap files must define window["sap-ushell-config"]; that is the ushell contract.
    files: ['webapp/sandboxConfig.js', 'webapp/test/flpSandboxConfig.js'],
    rules: { '@sap-ux/fiori-tools/sap-no-global-define': 'off' },
  },
];
