/**
 * Functionality supporting the allgames.php page. This script is loaded with the page load then pageLoaded is called
 * from varyn.initApp().
 *
 */
var varynAllGamesPage = function (varynApp, siteConfiguration) {
    "use strict";

    var enginesisSession = varynApp.getEnginesisSession();

    return {
        pageLoaded: function (pageViewParameters) {
            // Load first 100 games. TODO: We should add paging capability if there are more than 100 games.
            enginesisSession.siteListGames(1, 100, 2, this.enginesisCallBack);
        },

        /**
         * Callback to handle responses from Enginesis.
         * @param enginesisResponse
         */
        enginesisCallBack: function (enginesisResponse) {
            var succeeded,
                errorMessage,
                results,
                fillDiv;

            if (enginesisResponse != null && enginesisResponse.fn != null) {
                results = enginesisResponse.results;
                succeeded = results.status.success;
                errorMessage = results.status.message;
                switch (enginesisResponse.fn) {
                    case "SiteListGames":
                        if (succeeded == 1) {
                            fillDiv = "AllGamesArea";
                            varynApp.gameListGamesResponse(results.result, fillDiv, null, false);
                        }
                        break;
                    default:
                        break;
                }
            }
        }
    };
};