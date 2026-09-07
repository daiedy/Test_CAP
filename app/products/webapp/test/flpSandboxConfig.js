// FLP sandbox configuration (externalized for CSP compliance). Tiles live in ../appconfig/fioriSandboxConfig.json,
// which sandbox.js merges last and which therefore overrides the SAP demo tiles. Intent products-display resolves
// the app relative to this page so it works behind CAP (:4004) and the UI5 dev server (:8080).
window["sap-ushell-config"] = {
    defaultRenderer: "fiori2",
    bootstrapPlugins: {
        "RuntimeAuthoringPlugin": {
            component: "sap.ushell.plugins.rta",
            config: {
                validateAppVersion: false
            }
        }
    },
    renderers: {
        fiori2: {
            componentData: {
                config: {
                    enableSearch: false,
                    rootIntent: "Shell-home"
                }
            }
        }
    },
    services: {
        "ClientSideTargetResolution": {
            "adapter": {
                "config": {
                    "inbounds": {
                        "products-display": {
                            "semanticObject": "products",
                            "action": "display",
                            "title": "Product Catalog",
                            "signature": {
                                "parameters": {},
                                "additionalParameters": "allowed"
                            },
                            "resolutionResult": {
                                "applicationType": "SAPUI5",
                                "additionalInformation": "SAPUI5.Component=products",
                                "url": "../"
                            }
                        }
                    }
                }
            }
        },
        "NavTargetResolution": {
            "config": {
                "enableClientSideTargetResolution": true
            }
        }
    }
};
