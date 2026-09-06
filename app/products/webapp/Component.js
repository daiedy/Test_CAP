sap.ui.define(
    ["sap/fe/core/AppComponent", "sap/ui/core/Element"],
    function (Component, Element) {
        "use strict";

        return Component.extend("products.Component", {
            metadata: {
                manifest: "json"
            },

            init: function() {
                Component.prototype.init.apply(this, arguments);

                setTimeout(function() {
                    const oExploreBtn = Element.getElementById("uh-explore-button");
                    if (oExploreBtn && !oExploreBtn._keyboardFixed) {
                        const oDomRef = oExploreBtn.getDomRef();
                        if (oDomRef) {
                            oDomRef.addEventListener("keydown", function(e) {
                                if (e.key === "Enter" || e.keyCode === 13 || e.key === " " || e.keyCode === 32) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    oDomRef.click();
                                }
                            });
                            oExploreBtn._keyboardFixed = true;
                        }
                    }
                }, 1500);
            }
        });
    }
);
