// Bootstraps the FLP sandbox renderer once the UI5 core is ready (externalized for CSP compliance).
sap.ui.require(["sap/ui/core/Core", "sap/ushell/Container"], function (Core, Container) {
  "use strict";
  Core.ready().then(function () {
    // createRenderer is deprecated without a successor; the replacement is the New Sandbox
    // (SandboxBootTask), a separate migration via the modernize-flp-sandbox skill. Tracked in STATE.
    // ui5lint-disable-next-line no-deprecated-api
    Container.createRenderer(null, true).then(function (renderer) {
      renderer.placeAt("content");
    });
  });
});
