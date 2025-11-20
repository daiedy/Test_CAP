sap.ui.define([
	"sap/ui/core/util/MockServer"
], function (MockServer) {
	"use strict";

	return {
		init: function () {
			const sMetadataUrl = sap.ui.require.toUrl("products/localService/metadata.xml");
			const sMockdataBaseUrl = sap.ui.require.toUrl("products/localService/mockdata");
			
			console.log("Initializing Mock Server...");
			console.log("Metadata URL:", sMetadataUrl);
			console.log("Mockdata URL:", sMockdataBaseUrl);

			const oMockServer = new MockServer({
				rootUri: "/odata/v4/catalog/"
			});

			const oUriParameters = new URLSearchParams(globalThis.location.search);

			MockServer.config({
				autoRespond: true,
				autoRespondAfter: oUriParameters.get("serverDelay") || 500
			});

			try {
				oMockServer.simulate(sMetadataUrl, {
					sMockdataBaseUrl: sMockdataBaseUrl,
					bGenerateMissingMockData: true,
					aAnnotations: []
				});
				
				oMockServer.start();
				console.log("✅ Mock server started successfully for /odata/v4/catalog/");
				console.log("Root URI:", oMockServer.getRootUri());
			} catch (error) {
				console.error("❌ Mock server failed to start:", error);
				console.error("Error details:", error.message, error.stack);
				throw error;
			}
		}
	};
});
