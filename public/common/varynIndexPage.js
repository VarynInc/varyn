/**
 * Functionality supporting the index.php page. This script is loaded with the page load then pageLoaded is called
 * from varyn.initApp().
 *
 */
var varynIndexPage = function (varynApp, siteConfiguration) {
    "use strict";

    var enginesisSession = varynApp.getEnginesisSession();

    return {
        pageLoaded: function (pageViewParameters) {
            // Load Hot Games, New Games, and Promotions
            enginesisSession.gameListListGames(siteConfiguration.gameListIdTop, this.enginesisCallBack.bind(this));
            enginesisSession.gameListListGames(siteConfiguration.gameListIdNew, this.enginesisCallBack.bind(this));
            enginesisSession.promotionItemList(siteConfiguration.homePagePromoId, enginesisSession.getDateNow(), this.enginesisCallBack.bind(this));
        },

        showHomePagePromotionModule: function(enginesisResponse) {
            var promoModuleHTML;
            var promoIndicatorHTML;
            var domElement;
            var numberOfPromos;
            var promotionItem;
            var i;

            domElement = document.getElementById("PromoCarousel");
            if (domElement != null && enginesisResponse != null && enginesisResponse.length > 0) {
                numberOfPromos = enginesisResponse.length;
                promoIndicatorHTML = this.makePromoIndicators(numberOfPromos, 0);
                promoModuleHTML = "<div id=\"PromoCarouselInner\" class=\"carousel-inner\" role=\"listbox\">";
                for (i = 0; i < numberOfPromos; i ++) {
                    promotionItem = enginesisResponse[i];
                    promoModuleHTML += this.makePromoModule(i == 0, promotionItem);
                }
                promoModuleHTML += "</div><a class=\"left carousel-control\" href=\"#PromoCarousel\" role=\"button\" data-slide=\"prev\"><span class=\"glyphicon glyphicon-chevron-left\"></span><span class=\"sr-only\">Previous</span></a><a class=\"right carousel-control\" href=\"#PromoCarousel\" role=\"button\" data-slide=\"next\"><span class=\"glyphicon glyphicon-chevron-right\"></span><span class=\"sr-only\">Next</span></a>";
                domElement.innerHTML = promoIndicatorHTML + promoModuleHTML;
            } else if (domElement != null) {
                domElement.innerText = "There are no promotions today.";
            }
        },

        /**
         * makePromoModule will generate the HTML for a single standard promo module for the carousel.
         * @param isActive bool the active module. The first module should be active.
         * @param promotionItem {object} all the details of a promotion item.
         * @returns {string} the HTML.
         */
        makePromoModule: function (isActive, promotionItem) {
            var innerHtml,
                isActiveItem,
                backgroundImg = promotionItem.promotion_item_img,
                altText = promotionItem.promotion_item_title,
                titleText = promotionItem.promotion_item_title,
                promoText = promotionItem.promotion_item_description,
                link = promotionItem.promotion_item_link,
                callToActionText = promotionItem.promotion_item_link_title;

            if (isActive) {
                isActiveItem = " active";
            } else {
                isActiveItem = "";
            }
            innerHtml = "<div class=\"item" + isActiveItem + "\">";
            innerHtml += "<div class=\"sliderContainer\" style=\"background:url(" + backgroundImg + ") center center; background-size:cover;\">";
            innerHtml += "<div class=\"carousel-caption\"><h3>" + titleText + "</h3>";
            innerHtml += "<p class=\"sliderCaption\">" + promoText + "</p>";
            if (varynApp.isURL(link)) {
                // if it is a real link then put it inside a button
                innerHtml += "<p><a class=\"btn btn-md btn-primary\" href=\"" + link + "\" role=\"button\">" + callToActionText + "</a></p>";
            } else {
                // if it is not a link then take it and try to figure out what it is really trying to say
                innerHtml += "<p>" + this.makeCallToActionButton(link, callToActionText) + "</p>";
            }
            innerHtml += "</div></div></div>";
            return innerHtml;
        },

        makeCallToActionButton: function(link, callToActionText) {
            var innerHTML;
            if (link.indexOf("showSubscribePopup") >= 0) {
                innerHTML = "<button type=\"button\" class=\"btn btn-md btn-danger\" data-toggle=\"modal\" data-target=\"#modal-subscribe\" onclick=\"" + link + "\">" + callToActionText + "</button>";
            } else {
                innerHTML = "<p><a class=\"btn btn-md btn-primary\" href=\"" + link + "\" role=\"button\">" + callToActionText + "</a></p>";
            }
            return innerHTML;
        },

        /**
         * makePromoIndicators generates the HTML for all promo indicators used in the carousel.
         * @param numberOfPromos
         * @param activeIndicator
         * @returns {string}
         */
        makePromoIndicators: function (numberOfPromos, activeIndicator) {
            var innerHtml = "<ol class=\"carousel-indicators\">",
                activeClass,
                i;

            if (activeIndicator === undefined || activeIndicator == null || activeIndicator < 0 || activeIndicator >= numberOfPromos) {
                activeIndicator = 0;
            }
            for (i = 0; i < numberOfPromos; i ++) {
                activeClass = (i == activeIndicator) ? " class=\"active\"" : "";
                innerHtml += "<li data-target=\"#PromoCarousel\" data-slide-to=\"" + i + "\"" + activeClass + "></li>";
            }
            innerHtml += "</ol>";
            return innerHtml;
        },

        /**
         * Callback to handle responses from Enginesis.
         * @param enginesisResponse
         */
        enginesisCallBack: function (enginesisResponse) {
            var succeeded,
                errorMessage,
                results,
                fillDiv,
                listId;

            if (enginesisResponse != null && enginesisResponse.fn != null) {
                results = enginesisResponse.results;
                succeeded = results.status.success;
                errorMessage = results.status.message;
                switch (enginesisResponse.fn) {
                    case "PromotionItemList":
                        if (succeeded == 1) {
                            this.showHomePagePromotionModule(results.result);
                        }
                        break;
                    case "GameListListGames":
                        if (succeeded == 1) {
                            if (results.passthru !== undefined && results.passthru.game_list_id !== undefined) {
                                listId = results.passthru.game_list_id;
                                if (listId == siteConfiguration.gameListIdTop) {
                                    fillDiv = "HomePageTopGames";
                                } else {
                                    fillDiv = "HomePageNewGames";
                                }
                            } else {
                                fillDiv = "HomePageTopGames";
                            }
                            varynApp.gameListGamesResponse(results.result, fillDiv, 30, false);
                        }
                        break;
                    default:
                        break;
                }
            }
        }

    };
};
