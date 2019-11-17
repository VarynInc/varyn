/**
 * Common JavaScript and utility functions used across Varyn.com. This script should be loaded on every page.
 * The initApp function requires a page-view object that is responsible for implementing page-specific
 * functionality.
 */
var varyn = function (parameters) {
    "use strict";

    var siteConfiguration = {
            debug: true,
            originWhiteList: ['www.enginesis.com', 'games.enginesis.com', 'metrics.enginesis.com', 'www.enginesis-l.com', 'games.enginesis-l.com', 'metrics.enginesis-l.com', 'www.enginesis-q.com', 'games.enginesis-q.com', 'metrics.enginesis-q.com'],
            varynUserInfoCookieName: 'varynuser',
            userInfoKey: 'varynuserinfo',
            developerKey: parameters.developerKey,
            siteId: parameters.siteId,
            gameId: parameters.gameId,
            gameGroupId: parameters.gameGroupId,
            serverStage: parameters.serverStage,
            serverHostDomain: 'varyn' + parameters.serverStage + '.com',
            languageCode: parameters.languageCode,
            gameListIdTop: parameters.gameListIdTop || 4,
            gameListIdNew: parameters.gameListIdNew || 5,
            homePagePromoId: parameters.homePagePromoId || 3,
            blogPagePromoId: parameters.blogPagePromoId || 4,
            gameListState: 1,
            userInfo: parameters.userInfo,
            authToken: parameters.authToken,

            minPasswordLength: 4,
            minUserNameLength: 3,
            minimumAge: 13
        },
        unconfirmedNetworkId = 1,
        currentPage = '',
        waitingForUserNameReply = false,
        domImage,
        enginesisSession = window.enginesis,
        pageViewParameters = null,
        _isLogout = false;

    /**
     * Network id is set by the Enginesis server based on what type of user login was performed.
     * @returns {number}
     */
    function getNetworkId () {
        var resultNetworkId;
        if (siteConfiguration.userInfo !== undefined && siteConfiguration.userInfo != null && siteConfiguration.userInfo.networkId !== undefined) {
            resultNetworkId = siteConfiguration.userInfo.networkId;
        } else {
            resultNetworkId = unconfirmedNetworkId;
        }
        return resultNetworkId;
    }

    /**
     * The server will give us a user info object as a cookie so that we know who is logged in on the client.
     */
    function getVarynUserInfoFromCookie () {
        var userInfoJSON = commonUtilities.cookieGet(siteConfiguration.varynUserInfoCookieName);
        if (userInfoJSON != null && userInfoJSON != '') {
            // TODO: verify the cookie user info has not been tampered with.
            return JSON.parse(userInfoJSON);
        }
        return null;
    }

    /**
     * If a prior user object was saved in local storage we can retrieve it.
     * @returns {null|object}
     */
    function getSavedUserInfo () {
        var userInfo = commonUtilities.loadObjectWithKey(siteConfiguration.userInfoKey);
        if (typeof userInfo === 'string') {
            userInfo = JSON.parse(userInfoJSON);
        }
        // TODO: verify the loaded user info has not been tampered with, at least verify the hash matches what is expected.
        // However, since this is data given to use from enginesis, enginesis must provide the API to verify this data.
        return userInfo;
    }

    /**
     * Save the verified logged in user info in local storage so we are able to remember who is
     * logged in over page loads.
     * @param userInfo
     * @returns {*}
     */
    function saveUserInfo (userInfo) {
        return commonUtilities.saveObjectWithKey(siteConfiguration.userInfoKey, userInfo);
    }

    /**
     * Remove the saved logged in user info.
     * @returns {*}
     */
    function clearSavedUserInfo () {
        return commonUtilities.removeObjectWithKey(siteConfiguration.userInfoKey);
    }

    return {

        /**
         * Call this to initialize the varyn app, get the Enginesis instance, and begin the page operations.
         */
        initApp: function(pageView, pageViewParameterObject) {

            var enginesisParameters = {
                    siteId: siteConfiguration.siteId,
                    gameId: siteConfiguration.gameId || 0,
                    gameGroupId: siteConfiguration.gameGroupId || 0,
                    serverStage: "enginesis." + siteConfiguration.serverHostDomain,
                    authToken: siteConfiguration.authToken || "",
                    developerKey: siteConfiguration.developerKey,
                    languageCode: this.parseLanguageCode(siteConfiguration.languageCode),
                    callBackFunction: this.enginesisCallBack.bind(this)
               },
               pageViewTemplate = null;

            _isLogout = pageViewParameterObject.isLogout;
            currentPage = this.getCurrentPage();
            pageViewParameters = pageViewParameterObject;
            enginesis.init(enginesisParameters);
            if (pageViewParameters != null && pageViewParameters.showSubscribe !== undefined && pageViewParameters.showSubscribe == '1') {
                varynApp.showSubscribePopup();
            }
            if (pageView !== undefined && pageView != null) {
                pageViewTemplate = pageView(varynApp, siteConfiguration);
                pageViewTemplate.pageLoaded(pageViewParameters);
            }
            if (_isLogout) {
                this.logout().then(function() {
                    if (typeof pageViewTemplate.logoutComplete !== 'undefined') {
                        pageViewTemplate.logoutComplete();
                    }
                });
            } else {
                this.checkIsUserLoggedIn();
            }
            return pageViewTemplate;
        },

        /**
         * Send an event we want to track to our tracking backend. This function helps abstract what that
         * backend is in case we want to use different ones or even multiple backends.
         * Google hit types are: pageview, screenview, event, transaction, item, social, exception, and timing.
         * @param category - string indicating the category for this event (e.g. 'login').
         * @param action - string indicating the action taken for this event (e.g. 'failed').
         * @param eventData - string indicating the data value for this event (e.g. 'userId').
         */
        trackEvent: function (category, action, eventData) {
            if (typeof gtag === 'function') {
                gtag({
                    "category": category,
                    "action": action,
                    "data": eventData
                });
            }
        },

        /**
         * Save the refresh token client-side. This means that the token is saved only on the device
         * the user successfully logs in in from. The app can use this token when the auth-token is
         * rejected due to TOKEN_EXPIRED error in order to ask for a new token.
         * @param refreshToken
         */
        saveRefreshToken: function (refreshToken) {
            if (enginesisSession != null) {
                enginesisSession.saveRefreshToken(refreshToken);
            }
        },

        /**
         * Return the current logged in user info object. We first check to see if we cached this
         * from a prior request, if not cached then check local storage, and if not there either then
         * see if the server gave it to us by cookie. If none of these check out we could make a
         * server call (TODO).
         * TODO: Verify the user is in fact logged in and the token is valid.
         * @returns {object|null} null if no user is logged in.
         */
        getVarynUserInfo: function () {
            // user info could come from authtok or cookie.
            var userInfo = siteConfiguration.userInfo;
            if (userInfo == null) {
                userInfo = commonUtilities.loadObjectWithKey(siteConfiguration.userInfoKey);
                if (userInfo == null) {
                    userInfo = getVarynUserInfoFromCookie();
                }
            }
            return userInfo;
        },

        getEnginesisSession: function () {
            return enginesisSession;
        },

        getSiteConfiguration: function () {
            return siteConfiguration;
        },

        isLogout: function() {
            return _isLogout;
        },

        parseLanguageCode: function (languageCode) {
            return languageCode.substr(0, 2);
        },

        /**
         * Determines if an email address appears to be a valid format.
         * @param {string} email address to check.
         * @returns {boolean}
         */
        isValidEmail: function (email) {
            var isValid = /\S+@\S+\.\S+/.test(email);
            return isValid;
        },

        /**
         * Determines if a user name appears to be a valid format. A user name must be
         * 3 to 20 characters.
         * @param {string} user name to check.
         * @returns {boolean}
         */
        isValidUserName: function (userName) {
            return /^[a-zA-Z0-9_@!~\$\.\-\|\s?]{3,20}$/.test(userName);
        },

        /**
         * Test if user name has changed from teh value we have in the userInfo object.
         * @param newUserName
         * @returns {boolean} Returns true if the provided user name is different from the cached value.
         */
        isChangedUserName: function (newUserName) {
            var userInfo = siteConfiguration.userInfo;
            if (userInfo == null) {
                userInfo = this.getVarynUserInfo();
            }
            return ! (userInfo != null && userInfo.user_name == newUserName);
        },

        /**
         * Use this function to determine if a given form field contains a value that is different than the
         * corresponding value in the userInfo cache. Returns true if the values are different.
         * @param fieldKey String the key in the userInfo object to check.
         * @param formId String the id on the DOM form to read.
         * @returns {boolean} true if the two values are different. false if they are the same.
         */
        isChangedUserInfoField: function (fieldKey, formId) {
            var result = false,
                fieldValue = null,
                formElement,
                formValue = null;

            if (siteConfiguration.userInfo !== undefined && siteConfiguration.userInfo != null && siteConfiguration.userInfo[fieldKey] !== undefined) {
                fieldValue = siteConfiguration.userInfo[fieldKey];
            }
            formElement = document.getElementById(formId);
            if (formElement != null) {
                formValue = formElement.value;
            }
            if (fieldValue != null && formValue != null) {
                result = fieldValue != formValue;
            }
            return result;
        },

        /**
         * Determines if a password appears to be a valid format.
         * @param {string} password to check.
         * @returns {boolean}
         */
        isValidPassword: function (password) {
            var trimmed = password.trim().length;
            return trimmed >= siteConfiguration.minPasswordLength && trimmed == password.length;
        },

        /**
         * Compute Age given date of birth. Actually, compute number of years since date provided.
         * @param {string} Date of birth is a string date format from an input type=date control, we expect yyyy-mm-dd.
         * @returns {number} Number of years.
         */
        ageInYearsFromNow: function (dob) {
            var today = new Date(),
                dateOfBirth = new Date(dob),
                millisecondsOneYear = 31536000000, // 1000 * 60 * 60 * 24 * 365,
                utc1,
                utc2;

            if (isNaN(dateOfBirth.getFullYear())) {
                dateOfBirth = today;
            }
            utc1 = Date.UTC(dateOfBirth.getFullYear(), dateOfBirth.getMonth(), dateOfBirth.getDate());
            utc2 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
            return Math.floor((utc2 - utc1) / millisecondsOneYear);
        },

        /**
         * Determines if a date of birth appears to be a valid. For this site users must be 13 years of age.
         * @param {string} dob - Date of birth is a string date format from an input type=date control.
         * @returns {boolean}
         */
        isValidDateOfBirth: function (dob) {
            return this.ageInYearsFromNow(dob) >= siteConfiguration.minimumAge;
        },

        /**
         * Varyn.com standard date format is www dd-mmm yyyy hh:mm aa, for example Sun 18-Sep 2016 11:15 PM
         * @param date
         */
        mysqlDateToHumanDate: function (date) {
            var internalDate = new Date(date),
                hours,
                minutes;

            if (internalDate == null) {
                internalDate = new Date();
            }
            hours = internalDate.getHours() % 12;
            if (hours < 1) {
                hours = '12';
            }
            minutes = internalDate.getMinutes() % 12;
            if (minutes < 10) {
                minutes = '0' + minutes;
            }
            return internalDate.toDateString() + ' ' + hours + ':' + minutes + ' ' + (internalDate.getHours() > 11 ? 'PM' : 'AM');
        },

        /**
         * Proper formatting of our numbers so they look nice.
         * @param number
         * @returns {string}
         */
        commaGroupNumber: function (number) {
            if (typeof number !== 'Number') {
                number = Number(number);
            }
            return number.toLocaleString();
        },

        /**
         * Return the current web page file name without extension.
         * @returns {string}
         */
        getCurrentPage: function () {
            var pageName = location.href.split('/').slice(-1);
            if (pageName.indexOf('.') > 0) {
                pageName = pageName.split('.').slice(0);
            } else if (pageName == '') {
                pageName = 'index';
            }
            return pageName.toString();
        },

        /**
         * We expect a standard errorContent div to appear on any page that will display an error message
         * resulting from a user interaction.
         * @param errorMessage
         * @param fieldWithError
         */
        showErrorMessage: function (errorMessage, fieldWithError) {
            var errorContent = document.getElementById('errorContent'),
                errorFieldElement = document.getElementById(fieldWithError);

            if (errorMessage == "") {
                errorContent.innerHTML = '<p>&nbsp;</p>';
            } else if (errorContent != null) {
                errorContent.innerHTML = '<p class="text-error">' + errorMessage + '</p>';
            }
            if (errorFieldElement != null) {
                $(errorFieldElement).removeClass("popup-form-input").addClass("popup-form-input-error");
                errorFieldElement.focus();
            }
        },

        /**
         * setElementSizeAndColor of DOM element
         * @param elementDiv - object of the DOM element
         * @param requiredWidth
         * @param requiredHeight
         * @param bgcolor
         */
        setElementSizeAndColor: function (elementDiv, requiredWidth, requiredHeight, bgcolor) {
            var style = "margin: 0; padding: 0; left: 0; top: 0; width: " + requiredWidth + "px; height: " + requiredHeight + "px; min-height: " + requiredHeight + "px !important; overflow: hidden;";
            if (bgcolor != null && bgcolor != "") {
                style += " background-color: " + bgcolor + ";";
            }
            elementDiv.setAttribute("style", style);
        },

        /**
         * This is a debug function to dump out the width&height of all children of the target div.
         * @param elementDiv
         */
        checkChildLayout: function (elementDiv) {
            var i,
                e,
                nodeName,
                childNodes = elementDiv.children;

            for (i = 0; i < childNodes.length; i ++) {
                e = childNodes[i];
                if (e.name != null) {
                    nodeName = e.name;
                } else if (e.id != null) {
                    nodeName = e.id;
                } else {
                    nodeName = e.localName;
                }
                console.log(elementDiv.localName + ": Child " + nodeName + " (" + e.style.width + "," + e.style.height + ")");
            }
        },

        /**
         * compareTitle is an array sort function to alphabetize an array by title
         * @param {object} a First object to compare.
         * @param {object} b Second object to compare.
         * @returns {number} 0 if equal, 1 if  is greater, -1 if b is greater
         */
        compareTitle: function (a, b) {
            if (a.title < b.title) {
                return -1;
            } else if (a.title > b.title) {
                return 1;
            } else {
                return 0;
            }
        },

        /**
         * compareDate is an array sort function to sort an array by descending date order.
         * @param {object} a First object to compare.
         * @param {object} b Second object to compare.
         * @param {string} property The property on both objects that is expected to be a date.
         * @returns {number} 0 if equal, 1 if  is greater, -1 if b is greater
         */
        compareDate: function (a, b, property) {
            if (a[property] < b[property]) {
                return 1;
            } else if (a[property] > b[property]) {
                return -1;
            } else {
                return 0;
            }
        },

        /**
         * insertAndExecute inserts HTML text into the provided <div id="id"> and if that new HTML includes
         * any script tags they will get evaluated.
         * @param id: element to insert new HTML text into.
         * @param text: the new HTML text to insert into id.
         */
        insertAndExecute: function (id, text) {
            document.getElementById(id).innerHTML = text;
            var scripts = document.getElementById(id).getElementsByTagName("script");
            for (var i = 0; i < scripts.length; i ++) {
                if (scripts[i].src != '') {
                    var tag = document.createElement('script');
                    tag.src = scripts[i].src;
                    document.getElementsByTagName('head')[0].appendChild(tag);
                } else {
                    eval(scripts[i].innerHTML);
                }
            }
        },

        /**
         * Check if this browser supports CORS.
         * @returns {boolean}
         */
        checkBrowserCORSCompatibility: function () {
            var supported = (typeof window.postMessage !== "undefined");
            return supported;
        },

        /**
         * Verify the originating request is coming from a trusted source.
         * @param origin
         * @returns {boolean}
         */
        verifyCORSWhiteList: function (origin) {
            var ok = false;
            for (var i=0; i < siteConfiguration.originWhiteList.length; i++) {
                if (origin === siteConfiguration.originWhiteList[i]) {
                    ok = true;
                    break;
                }
            }
            return ok;
        },

        /**
         * showSubscribePopup show the popup form to capture an email address to subscribe to the newsletter.
         */
        hideSubscribePopup: function () {
            this.showSubscribePopup(false);
        },

        /**
         * showSubscribePopup show the popup form to capture an email address to subscribe to the newsletter.
         * TODO: track if user already signed up?
         */
        showSubscribePopup: function (showFlag) {
            if (showFlag) {
                document.getElementById("subscribe-email").value = enginesisSession.anonymousUserGetSubscriberEmail();
                // $('#modal-subscribe').modal('show');
                this.setPopupMessage('modal-subscribe', '', null);
                this.trackEvent('subscribe', 'prompt', currentPage);
            } else {
                $('#modal-subscribe').modal('hide');
            }
        },

        /**
         * showRegistrationPopup show the popup form to capture an new quick registration. This is a short form,
         * for the long form go to the profile.php page.
         */
        showRegistrationPopup: function (showFlag) {
            if (showFlag) {
                $('#modal-register').modal('show');
                this.setPopupMessage('modal-register', '', null);
                this.onChangeRegisterUserName(document.getElementById('register-username'), 'popup_user_name_unique');
                this.trackEvent('register', 'prompt', currentPage);
            } else {
                $('#modal-register').modal('hide');
            }
        },

        /**
         * showLoginPopup show the popup form to capture an new quick registration. This is a short form,
         * for the long form go to the profile.php page.
         */
        showLoginPopup: function (showFlag) {
            if (showFlag) {
                $('#modal-login').modal('show');
                this.setPopupMessage('modal-login', '', null);
                this.trackEvent('login', 'prompt', currentPage);
            } else {
                $('#modal-login').modal('hide');
            }
        },

        /**
         * showForgotPasswordPopup show the popup form initiate forgot password flow.
         */
        showForgotPasswordPopup: function (showFlag) {
            if (showFlag) {
                $('#modal-forgot-password').modal('show');
                this.setPopupMessage('modal-forgot-password', '', null);
                this.trackEvent('forgotpassword', 'prompt', currentPage);
            } else {
                $('#modal-forgot-password').modal('hide');
            }
        },

        /**
         * Find the popup DOM element and set its internal text to the message and add a CSS class if one is provided.
         * @param popupId {string} DOM id of the element holding the message area.
         * @param message {string} the message to show.
         * @param className {string} optional class to add to the popupId element.
         */
        setPopupMessage: function (popupId, message, className) {
            var messageClass = 'modalMessageArea',
                messageElement = $('#' + popupId).find('.' + messageClass);

            if (messageElement != null) {
                messageElement.css('display', 'block');
                messageElement.text(message);
                if (className != null) {
                    messageElement.attr('class', messageClass + ' ' + className);
                }
            }
        },

        /**
         * Close all popups. Being not so smart, we set all popups we know of to display:none.
         * TODO: Smarter approach would be to take all .popupFrame elements and set them to display:none.
         */
        popupCloseClicked: function () {
            this.closeInfoMessagePopup();
            this.showSubscribePopup(false);
            this.showLoginPopup(false);
            this.showRegistrationPopup(false);
            this.showForgotPasswordPopup(false);
            // $('.popupFrame').attr('display', 'none');
        },

        /**
         * Display a take-over popup with a title and message. Use this as a general informational popup on any page.
         * @param title - title text of popup.
         * @param message - message HTML shown inside popup body.
         * @param timeToClose - number of milliseoncds to auto-close the popup. 0 to never close automatically.
         */
        showInfoMessagePopup: function (title, message, timeToClose) {
            var popupTitle = document.getElementById("infoMessageTitle"),
                popupMessage = document.getElementById("infoMessageArea");

            popupTitle.innerText = title;
            popupMessage.innerHTML = message;
            $('#modal-message').modal('show');
            if (timeToClose > 0) {
                window.setTimeout(this.closeInfoMessagePopup.bind(this), timeToClose);
            }
        },

        /**
         * Closes the popup that was opened with showInfoMesssagePopup.
         * TODO: Maybe smart to cancel the close interval if this was closed from the close button.
         */
        closeInfoMessagePopup: function () {
            $('#modal-message').modal('hide');
        },


        /**
         * The submit button was clicked on the subscribe popup. Validate user inputs before we
         * attempt to submit the request with the server. Will set focus to a field in error. This
         * function also auto-submits the request ajax style so the form submit is not used. If
         * successful the popup will dismiss automatically after a timer.
         *
         * @return boolean true if ok to submit the form
         */
        popupSubscribeClicked: function () {
            var email = document.getElementById("subscribe-email").value,
                errorField = "";

            if (this.isValidEmail(email)) {
                this.setPopupMessage("modal-subscribe", "Subscribing " + email + " with the service...", "popupMessageResponseOK");
                enginesisSession.anonymousUserSetSubscriberEmail(email);
                enginesisSession.newsletterAddressAssign(email, '', '', '2', null); // the newsletter category id for Varyn/General is 2
                this.trackEvent('subscribe', 'submit', currentPage);
            } else {
                errorField = "subscribe-email";
                this.setPopupMessage("modal-subscribe", "Your email " + email + " looks bad. Can you try again?", "popupMessageResponseError");
                document.getElementById(errorField).focus();
            }
            return errorField == "";
        },

        /**
         * The submit button was clicked on the registration popup. Validate user inputs on the quick registration form before we
         * attempt to submit the request with the server. Will set focus to a field in error.
         *
         * @returns {boolean} true if ok to submit the form
         */
        popupRegistrationClicked: function () {
            var email = document.getElementById("register-email").value,
                password = document.getElementById("register-password").value,
                userName = document.getElementById("register-username").value,
                agreement = document.getElementById("register-agreement").value,
                errorField = "";

            if (errorField == "" && ! this.isValidEmail(email)) {
                this.setPopupMessage("modal-register", "Your email " + email + " looks bad. Can you try again?", "popupMessageResponseError");
                errorField = "register-email";
            }
            if (errorField == "" && ! this.isValidUserName(userName)) {
                this.setPopupMessage("modal-register", "Your user name " + userName + " looks bad. Can you try again?", "popupMessageResponseError");
                errorField = "register-username";
            }
            if (errorField == "" && ! this.testUserNameIsUnique('popup_user_name_unique')) {
                this.setPopupMessage("modal-register", "Your user name " + userName + " is in use by another user. Please pick a unique user name.", "popupMessageResponseError");
                errorField = "register-username";
            }
            if (errorField == "" && ! this.isValidPassword(password)) {
                this.setPopupMessage("modal-register", "Your password looks bad. Can you try again?", "popupMessageResponseError");
                errorField = "register-password";
            }
            if (errorField == "" && agreement < 2) {
                this.setPopupMessage("modal-register", "You must agree with the terms of use or you cannot register.", "popupMessageResponseError");
                errorField = "register-agreement";
            }
            if (errorField != "") {
                $(errorField).removeClass("popup-form-input").addClass("popup-form-input-error");
                document.getElementById(errorField).focus();
            }
            if (errorField == "") {
                document.getElementById("registration-form").submit();
                this.trackEvent('register', 'submit', currentPage);
            }
            return errorField == ""; // return true to submit form
        },

        /**
         * The submit button on the login popup was clicked. Validate user inputs on the login form before we
         * attempt to submit the request with the server. Will set focus to a field in error.
         *
         * @returns {boolean} true if ok to submit the form
         */
        popupLoginClicked: function () {
            var password = document.getElementById("login_password").value.toString(),
                userName = document.getElementById("login_username").value.toString(),
                errorField = "";

            if (errorField == "" && ! this.isValidUserName(userName)) {
                this.setPopupMessage("modal-login", "Your user name " + userName + " looks bad. Can you try again?", "popupMessageResponseError");
                errorField = "login_username";
            }
            if (errorField == "" && ! this.isValidPassword(password)) {
                this.setPopupMessage("modal-login", "Your password looks bad. Can you try again?", "popupMessageResponseError");
                errorField = "login_password";
            }
            if (errorField != "") {
                $(errorField).removeClass("popup-form-input").addClass("popup-form-input-error");
                document.getElementById(errorField).focus();
            }
            if (errorField == "") {
                document.getElementById("login-form").submit();
                this.trackEvent('login', 'submit', currentPage);
            }
            return errorField == ""; // return true to submit form
        },

        /**
         * The submit button on the forgot password popup was clicked. Validate user inputs on the
         * forgot password form before we attempt to submit the request with the server. Will
         * set focus to a field in error.
         *
         * @returns {boolean} true if ok to submit the form
         */
        popupForgotPasswordClicked: function () {
            var email = document.getElementById("forgotpassword_email").value.toString(),
                userName = document.getElementById("forgotpassword_username").value.toString(),
                errorField = "";

            if (errorField == "" && ! this.isValidUserName(userName)) {
                this.setPopupMessage("modal-forgot-password", "Your user name '" + userName + "' looks bad. Can you try again?", "popupMessageResponseError");
                errorField = "forgotpassword_username";
            }
            if (errorField == "" && ! this.isValidEmail(email)) {
                this.setPopupMessage("modal-forgot-password", "Your email " + email + " looks bad. Can you try again?", "popupMessageResponseError");
                errorField = "forgotpassword_email";
            }
            if (errorField != "") {
                $(errorField).removeClass("popup-form-input").addClass("popup-form-input-error");
                document.getElementById(errorField).focus();
            }
            if (errorField == "") {
                document.getElementById("forgot-password-form").submit();
                this.trackEvent('forgotpassword', 'submit', currentPage);
            }
            return errorField == ""; // return true to submit form
        },

        /**
         * The submit button on the forgot password form was clicked. Validate user inputs on the
         * forgot password form before we attempt to submit the request with the server. Will
         * set focus to a field in error.
         *
         * @returns {boolean} true if ok to submit the form
         */
        formForgotPasswordClicked: function () {
            var email = document.getElementById("forgotpassword_email_form").value.toString(),
                userName = document.getElementById("forgotpassword_username_form").value.toString(),
                errorField = "";

            if (errorField == "" && ! this.isValidUserName(userName)) {
                this.setPopupMessage("forgot-password-form", "Your user name '" + userName + "' looks bad. Can you try again?", "popupMessageResponseError");
                errorField = "forgotpassword_username";
            }
            if (errorField == "" && ! this.isValidEmail(email)) {
                this.setPopupMessage("forgot-password-form", "Your email " + email + " looks bad. Can you try again?", "popupMessageResponseError");
                errorField = "forgotpassword_email";
            }
            if (errorField != "") {
                $(errorField).removeClass("popup-form-input").addClass("popup-form-input-error");
                document.getElementById(errorField).focus();
            }
            return errorField == ""; // return true to submit form
        },

        /**
         * If the show password UI element is activated then toggle the state of the password input.
         * @param element
         */
        onClickShowPassword: function(element) {
            var showPasswordCheckbox = document.getElementById('register-showpassword'),
                passwordInput = document.getElementById('register-password'),
                icon = document.getElementById('register-showpassword-icon'),
                text = document.getElementById('register-showpassword-text'),
                show = false;

            if (showPasswordCheckbox != null) {
                if (passwordInput == null) {
                    passwordInput = document.getElementById('newPassword');
                }
                show = passwordInput.type == 'text';
                if (show) {
                    showPasswordCheckbox.checked = false;
                    passwordInput.type = 'password';
                    icon.className = 'glyphicon glyphicon-eye-open';
                    text.innerText = 'Show';
                } else {
                    showPasswordCheckbox.checked = true;
                    passwordInput.type = 'text';
                    icon.className = 'glyphicon glyphicon-eye-close';
                    text.innerText = 'Hide';
                }
            }
        },

        /**
         * Single sign-on registration. In this case, the user id comes from a 3rd party network and we need to map that
         * to an new Enginesis user_id. Additional processing/error checking must be handled in the Enginesis callback.
         * This is used in a callback function that has no this context.
         * @param {object} registrationParameters is a KV object. The keys must match the Enginesis UserLoginCoreg API
         * @param {int} networkId is the network identifier, see Enginesis documentation
         */
        registerSSO: function (registrationParameters, networkId) {
            if (! _isLogout && registrationParameters != undefined && registrationParameters != null) {
                if (networkId === undefined || networkId === null && registrationParameters.networkId !== undefined) {
                    networkId = registrationParameters.networkId;
                }
                unconfirmedNetworkId = networkId;
                varynApp.trackEvent('login-complete', 'sso', varynApp.networkIdToString(networkId));
                enginesisSession.userLoginCoreg(registrationParameters, networkId, null);
            } else if (_isLogout) {
                var forceSignout = true;
                if (forceSignout) {
                    ssoGoogle.logout(function() {
                        console.log("Google user is logged out");
                    });
                }
            }
        },

        /**
         * Read our cookie/local storage to see if we think we already have a logged in user.
         * If we think we do, we still need to validate it.
         * If we do not then we can iterate over all know SSO services to see if any one of them thinks we are logged in.
         * This method is asynchronous and is required to end by calling either loginSSOSucceeded or loginSSOFailed.
         */
        checkIsUserLoggedIn: function() {
            if (enginesisSession.isUserLoggedIn()) {
                // if a user is logged in by any method we will have an Enginesis session to back it up.
                this.checkLoggedInSSO(enginesis.networkId).then(this.loginSSOSucceeded, this.loginSSOFailed);
            } else {
                // if Enginesis has no session we could iterate each service to see if we have a logged in user, but
                // for now we will just assume we don't and ask the user to login.
                // this.checkLoggedInSSO(-1).then(this.loginSSOSucceeded, this.loginSSOFailed);
                var supportedNetworksIdList = this.loadAllSupportedNetworks();
                if (supportedNetworksIdList.length > 0) {
                    // Decided not to do this as it's a lot of trouble waiting around for all these SDKs to check
                    // if someone is logged in, and we should be caching that info in the Varyn and Enginesis SSO state.
                    // this.checkIsUserLoggedInNetworkId(supportedNetworksIdList, supportedNetworksIndex);
                } else {
                    this.loginSSOFailed(null);
                }
            }
        },

        /**
         * Load all SSO networks handlers.
         * @returns {Array} - array of the network-id's that were loaded.
         */
        loadAllSupportedNetworks: function() {
            var supportedNetworks = enginesisSession.supportedSSONetworks(),
                supportedNetworksIdList = [];

            // build a list of networks we are going to check. TODO: Could order this list based on preference.
            for (var network in supportedNetworks) {
                if (supportedNetworks.hasOwnProperty(network) && network != 'Enginesis') {
                    supportedNetworksIdList.push(supportedNetworks[network]);
                    this.loadSupportedNetwork(supportedNetworks[network]);
                }
            }
            return supportedNetworksIdList;
        },

        /**
         * Clear any cached user info and forget this user. Also logout from connected network. Resolves the
         * Promise once the logout is complete since it may take a while over the network.
         */
        logout: function () {
            var thatVarynApp = this;
            var forceSignout = false; // TODO: Using this for testing when we must for a user to log out
            var networkId = enginesis.networkId; // this should be the network-id the user logged in with

            return new Promise(function(resolvePromise, rejectPromise) {
                clearSavedUserInfo();
                enginesis.clearRefreshToken();

                // TODO: To force google logout 1. load SDK, 2. wait for load complete 3. logoutSSO.
                if (forceSignout) {
                    ssoGoogle.load({
                        networkId: enginesis.supportedNetworks.Google,
                        logoutCallback: function () {
                            thatVarynApp.checkIsUserLoggedIn();
                            resolvePromise();
                        }
                    });
                } else {
                    thatVarynApp.logoutSSO(networkId, function () {
                        thatVarynApp.checkIsUserLoggedIn();
                        resolvePromise();
                    });
                }
            });
        },

        /**
         * Convert a networkId integer into its representative string.
         * @param networkId
         * @returns {string|null}
         */
        networkIdToString: function(networkId) {
            var result = null;
            switch (networkId) {
                case enginesis.supportedNetworks.Enginesis:
                    result = 'Enginesis';
                    break;
                case enginesis.supportedNetworks.Facebook:
                    result = 'Facebook';
                    break;
                case enginesis.supportedNetworks.Google:
                    result = 'Google';
                    break;
                case enginesis.supportedNetworks.Twitter:
                    result = 'Twitter';
                    break;
            }
            return result;
        },

        /**
         * Trigger the SDK load for the given network.
         * @param networkId
         */
        loadSupportedNetwork: function(networkId) {
            switch (networkId) {
                case enginesis.supportedNetworks.Enginesis: // Enginesis is always loaded
                    break;
                case enginesis.supportedNetworks.Facebook:
                    if (typeof ssoFacebook !== 'undefined') {
                        ssoFacebook.load(null);
                    }
                    break;
                case enginesis.supportedNetworks.Google:
                    if (typeof ssoGoogle !== 'undefined') {
                        ssoGoogle.load(null);
                    }
                    break;
                case enginesis.supportedNetworks.Twitter:
                    if (typeof ssoTwitter !== 'undefined') {
                        ssoTwitter.load(null);
                    }
                    break;
                case enginesis.supportedNetworks.Apple:
                    if (typeof ssoApple !== 'undefined') {
                        ssoApple.load(null);
                    }
                    break;
                default:
                    break;
            }
        },

        /**
         * Check is a user is already logged in to a specified network.
         * @param supportedNetworksIdList
         * @param supportedNetworksIndex
         */
        checkIsUserLoggedInNetworkId: function(supportedNetworksIdList, supportedNetworksIndex) {
            var that = this;
            if (supportedNetworksIdList.length > supportedNetworksIndex) {
                that.checkLoggedInSSO(supportedNetworksIdList[supportedNetworksIndex]).then(
                    function(userInfo) {
                        if (userInfo == null || userInfo instanceof Error) {
                            supportedNetworksIndex ++;
                            that.checkIsUserLoggedInNetworkId(supportedNetworksIdList, supportedNetworksIndex);
                        } else {
                            that.loginSSOSucceeded(userInfo);
                        }
                    },
                    function() {
                        supportedNetworksIndex ++;
                        that.checkIsUserLoggedInNetworkId(supportedNetworksIdList, supportedNetworksIndex);
                    }
                );
            } else {
                that.loginSSOFailed(new Error('User is not logged in after checking ' + supportedNetworksIndex + ' networks.'));
            }
        },

        loginSSOSucceeded: function (userInfo) {
            // TODO: match up any changed user info from the service
            if (pageViewParameters != null && pageViewParameters['userInfo'] !== undefined && pageViewParameters.userInfo != '') {
                siteConfiguration.userInfo = JSON.parse(pageViewParameters.userInfo); // when user logs in first time this is passed from PHP
                saveUserInfo(siteConfiguration.userInfo);
            } else {
                siteConfiguration.userInfo = getSavedUserInfo(); // when user already logged in this is saved locally
                if (siteConfiguration.userInfo == null) {
                    // TODO: This is a critical error, we expect the userInfo object to be available if the user is logged in.
                }
            }
        },

        loginSSOFailed: function (error) {
            if (enginesisSession.isUserLoggedIn()) {
                // TODO: This is a critical error, enginesis thought user was logged in but network service said no. Probably expired token. Could also be a hacker.
            } else {
                if (error) {
                    if (error instanceof Error) {
                        console.log('Error from varyn.loginSSOFailed: ' + error.message);
                    } else if (typeof error === 'string') {
                        console.log('Error from varyn.loginSSOFailed: ' + error);
                    } else {
                        console.log('Error from varyn.loginSSOFailed: ' + error.toString());
                    }
                }
            }
        },

        /**
         * If we think this user should be logged in on a certain network then verify that network also agrees.
         * @param networkId
         * @return {Promise} since this takes a network call to figure out.
         */
        checkLoggedInSSO: function (networkId) {
            return new Promise(function(resolvePromise, rejectPromise) {
                switch (networkId) {
                    case enginesis.supportedNetworks.Enginesis:
                        if (enginesisSession.isUserLoggedIn()) {
                            resolvePromise(enginesis.getLoggedInUserInfo());
                        } else {
                            rejectPromise(null);
                        }
                        break;
                    case enginesis.supportedNetworks.Facebook:
                        if (ssoFacebook) {
                            ssoFacebook.loadThenLogin(null).then(resolvePromise, rejectPromise);
                        }
                        break;
                    case enginesis.supportedNetworks.Google:
                        if (ssoGoogle) {
                            ssoGoogle.loadThenLogin(null).then(resolvePromise, rejectPromise);
                        }
                        break;
                    case enginesis.supportedNetworks.Twitter:
                        if (ssoTwitter) {
                            ssoTwitter.loadThenLogin(null).then(resolvePromise, rejectPromise);
                        }
                        break;
                    case enginesis.supportedNetworks.Apple:
                        if (ssoApple) {
                            ssoApple.loadThenLogin(null).then(resolvePromise, rejectPromise);
                        }
                        break;
                    default:
                        // A network we do not handle
                        rejectPromise(Error('Network ' + networkId + ' is not handled with SSO.'));
                        break;
                }
            });
        },

        /**
         * Single sign-on login. In this case, the user id comes from a 3rd party network and we need to map that
         * to an existing Enginesis user_id.
         * @param {object} registrationParameters is a KV object. THe keys must match the Enginesis UserLoginCoreg API
         * @param {int} networkId is the network identifier, see Enginesis documentation
         */
        loginSSO: function (registrationParameters, networkId) {
            if (! _isLogout && registrationParameters != undefined && registrationParameters != null) {
                unconfirmedNetworkId = networkId;
                enginesisSession.userLoginCoreg(registrationParameters, networkId, null);
            } else if (_isLogout) {
                var forceSignout = true;
                if (forceSignout) {
                    ssoGoogle.logout(function() {
                        console.log("Google user is logged out");
                    });
                }
            }
        },

        /**
         * Trigger the SDK load for the given network.
         * @param networkId
         * @param callMeWhenComplete - function to call once logged out. Can be null.
         */
        logoutSSO: function(networkId, callMeWhenComplete) {
            switch (networkId) {
                case enginesis.supportedNetworks.Enginesis: // Enginesis is always loaded
                    if (typeof callMeWhenComplete !== 'undefined' && callMeWhenComplete != null) {
                        callMeWhenComplete();
                    }
                    break;
                case enginesis.supportedNetworks.Facebook:
                    if (typeof ssoFacebook !== 'undefined') {
                        ssoFacebook.logout(callMeWhenComplete);
                    }
                    break;
                case enginesis.supportedNetworks.Google:
                    if (typeof ssoGoogle !== 'undefined') {
                        ssoGoogle.logout(callMeWhenComplete);
                    }
                    break;
                case enginesis.supportedNetworks.Twitter:
                    if (typeof ssoTwitter !== 'undefined') {
                        ssoTwitter.logout(callMeWhenComplete);
                    }
                    break;
                case enginesis.supportedNetworks.Apple:
                    if (typeof ssoApple !== 'undefined') {
                        ssoApple.logout(callMeWhenComplete);
                    }
                    break;
                default:
                    break;
            }
        },

        ssoStatusCallback: function (networkId, callbackInfo) {
            switch (networkId) {
                case enginesis.supportedNetworks.Facebook:
                    FB.getLoginStatus(varynApp.facebookStatusChangeCallback);
                    break;
                case enginesis.supportedNetworks.Google:
                    if (callbackInfo != null) {
                        if (callbackInfo.isSignedIn.get()) {
                            console.log('Gplus user is signed in');
                        } else {
                            console.log('Gplus user is NOT signed in');
                        }
                    }
                    break;
                case enginesis.supportedNetworks.Twitter:
                    break;
                default:
                    console.log("varynApp.checkLoginStateSSO unsupported network " + networkId);
                    break;
            }
        },

        /**
         * Setup any keyboard listeers the page should be looking out for.
         */
        setKeyboardListeners: function() {
            // document.addEventListener('keydown', this.keyboardListener.bind(this));
        },

        keyboardListener: function(event) {
            if (event && event.key) {
                if (event.key == '?') {
                    this.setFocusToSearchInput();
                    event.preventDefault();
                }
            }
        },

        /**
         * Force focus to the search input and clear it.
         */
        setFocusToSearchInput: function() {
            var searchElements = document.getElementsByName('q');
            if (searchElements && searchElements.length > 0) {
                searchElements = searchElements[0];
                searchElements.focus();
                searchElements.value = '';
            }
        },

        /**
         * This function sets up the events to monitor a change to the user name in a registration input form so we
         * can ask the server to test if the user name is already in use.
         */
        setupRegisterUserNameOnChangeHandler: function () {
            var userNameElement = document.getElementById('register-username');
            if (userNameElement != null) {
                userNameElement.addEventListener('change', this.onChangeRegisterUserName.bind(this));
                userNameElement.addEventListener('input', this.onChangeRegisterUserName.bind(this));
                userNameElement.addEventListener('propertychange', this.onChangeRegisterUserName.bind(this));
            }
        },

        /**
         * On change handler for the user name field on a registration form.
         * Try to make sure the user name is unique.
         * @param {object} DOM element that is changing.
         * @param {string} DOM id that will receive update of name status either acceptable or unacceptable.
         */
        onChangeRegisterUserName: function (element, domIdImage) {
            var userName;
            if ( ! waitingForUserNameReply && element != null) {
                if (element.target != null) {
                    element = element.target;
                }
                if (domIdImage == null) {
                    domIdImage = $(element).data("target");
                }
                userName = element.value.toString();
                if (varynApp.isChangedUserName(userName)) {
                    if (userName && varynApp.isValidUserName(userName)) {
                        waitingForUserNameReply = true;
                        domImage = domIdImage;
                        enginesisSession.userGetByName(userName, varynApp.onChangeRegisteredUserNameResponse.bind(varynApp));
                    } else {
                        this.setUserNameIsUnique(domIdImage, false);
                    }
                } else {
                    this.setUserNameIsUnique(domIdImage, true);
                }
            }
        },

        onChangeRegisteredUserNameResponse: function (enginesisResponse) {
            var userNameAlreadyExists = false;
            waitingForUserNameReply = false;
            if (enginesisResponse != null && enginesisResponse.fn != null) {
                userNameAlreadyExists = enginesisResponse.results.status.success == "1";
            }
            this.setUserNameIsUnique(domImage, ! userNameAlreadyExists);
            domImage = null;
        },

        /**
         * When we dynamically query the server to determine if the user name is a unique selection
         * use this function to indicate uniqueness result on the form.
         * @param {string} id for which DOM element we wish to manipulate.
         * @param {boolean} isUnique true if the name is unique, false if it is taken by someone else.
         */
        setUserNameIsUnique: function (id, isUnique) {
            if (id) {
                var element = document.getElementById(id);
                if (element != null) {
                    if (isUnique) {
                        element.classList.remove('username-is-not-unique');
                        element.classList.add('username-is-unique');
                        element.style.display = "inline-block";
                    } else {
                        element.classList.remove('username-is-unique');
                        element.classList.add('username-is-not-unique');
                        element.style.display = "inline-block";
                    }
                }
            }
        },

        /**
         * Test to check the last status of the user is unique attribute on the registration form. Take care because
         * this depends on that element being properly set and I really don't like this particular solution but
         * going with it for now. TODO: better solution?
         * @param id {string} the element to check (because it is a different id on different forms.)
         * @returns {boolean} true if the name is unique, false if it is taken.
         */
        testUserNameIsUnique: function (id) {
            var isUnique = $('#' + id).hasClass('username-is-unique');
            return isUnique;
        },

        /**
         * On change handler for the user email field on a registration form.
         * Try to make sure the email is valid and reset any error conditions.
         * @param {object} DOM element that is changing.
         */
        onChangeEmail: function (event) {
            if (event && event.target) {
                var element = event.target;
                var isError = false;
                if (event.type == "change") {
                    if ( ! this.isValidEmail(element.value)) {
                        this.showErrorMessage("Your email " + element.value + " looks bad. Can you try again?", element.id);
                        isError = true;
                    }
                }
                if ( ! isError) {
                    element.classList.remove("popup-form-input-error");
                    element.classList.add("popup-form-input");
                    this.showErrorMessage("", null);
                }
            }
        },

        /**
         * When a response to one of our form submissions returns from the server we handle it here.
         * If the result is a success we close the popup after a delay to confirm with the user the
         * successful status. If the result is an error we display the error message.
         */
        handleNewsletterServerResponse: function (succeeded, errorMessage) {
            if (succeeded == 1) {
                this.setPopupMessage("modal-subscribe", "You are subscribed - Thank you!", "popupMessageResponseOK");
                window.setTimeout(this.hideSubscribePopup.bind(this), 2500);
            } else {
                this.setPopupMessage("modal-subscribe", "Service reports an error: " + errorMessage, "popupMessageResponseError");
            }
        },

        /**
         * makeGameModule will generate the HTML for a standard game card.
         * @param gameId {int}
         * @param gameName {string}
         * @param gameDescription {string}
         * @param gameImg {string}
         * @param gameLink {string}
         * @param isFavorite {boolean}
         * @returns {string} the HTML
         */
        makeGameModule: function (gameId, gameName, gameDescription, gameImg, gameLink, isFavorite) {
            var innerHtml,
                favoriteImgSrc,
                title;

            title = "Play " + gameName + " Now!";
            favoriteImgSrc = isFavorite ? "/images/favorite-button-on-196.png" : "/images/favorite-button-off-196.png";
            innerHtml = "<div class=\"gameModule thumbnail\">";
            innerHtml += "<a href=\"" + gameLink + "\" title=\"" + title + "\"><img class=\"thumbnail-img\" src=\"" + gameImg + "\" alt=\"" + gameName + "\"/></a>";
            innerHtml += "<div class=\"gameModuleInfo\"><a href=\"" + gameLink + "\" class=\"btn btn-md btn-success\" role=\"button\" title=\"" + title + "\" alt=\"" + title + "\">Play Now!</a><img class=\"favorite-button\" src=\"" + favoriteImgSrc + "\" data-game-id=\"" + gameId + "\" alt=\"Add " + gameName + " to your favorite games\"></div>";
            innerHtml += "<div class=\"caption\"><a class=\"gameTitle\" href=\"" + gameLink + "\" title=\"" + title + "\"><h3>" + gameName + "</h3></a><p class=\"gamedescription\">" + gameDescription + "</p>";
            innerHtml += "</div></div>";
            return innerHtml;
        },

        /**
         * makeAdModule will generate the HTML for a standard ad module.
         * @returns {string} the HTML
         */
        makeAdModule: function () {
            var innerHtml;

            innerHtml = '<div class="gameModule thumbnail"><div class="row"><div class="col-sm-4 col-md-2 adContainer412"><div id="boxAd300" class="ad300x412">';
            innerHtml += '<iframe src="/common/adModule.html" frameborder="0" scrolling="no" style="width: 300px; height: 412px; overflow: hidden; z-index: 9999; left: 0px; bottom: 0px; display: inline-block;"></iframe></div></div></div></div>';
            return innerHtml;
        },

        /**
         * makeCouponModule will generate the HTML for a standard Coupons.com module.
         * @returns {string} the HTML
         */
        makeCouponModule: function () {
            var innerHtml;

            innerHtml = '<div class="gameModule thumbnail"><div class="row"><div class="col-sm-4 col-md-2 adContainer412"><div id="boxAd300" class="ad300x412">';
            innerHtml += '<iframe src="/common/couponModule.html" frameborder="0" scrolling="no" style="width: 300px; height: 412px; overflow: hidden; z-index: 9999; left: 0px; bottom: 0px; display: inline-block;"></iframe></div></div></div></div>';
            return innerHtml;
        },

        /**
         * Determine if a string looks like a certain type of URL.
         * @param string
         * @returns bool true if it meets our criteria: //, http://, or https://.
         */
        isURL: function (string) {
            return string.startsWith("/") || string.startsWith("http://") || string.startsWith("https://");
        },

        /**
         * gameListGamesResponse handles the server reply from GameListListGames and generates the game modules.
         * @param results {object}: the sever response object
         * @param elementId {string}: element to insert game modules HTML
         * @param maxItems {int}: no more than this number of games
         * @param sortProperty {string}: sort the list of games by this property
         */
        gameListGamesResponse: function (results, elementId, maxItems, sortProperty) {
            // results is an array of games
            var i,
                adsShownCounter,
                gameItem,
                gamesContainer = document.getElementById(elementId),
                newDiv,
                itemHtml,
                countOfGamesShown,
                baseURL = document.location.protocol + "//" + enginesisSession.serverBaseUrlGet() + "/games/",
                isTouchDevice = enginesisSession.isTouchDevice(),
                isFavorite,
                adsDisplayPositions = [3, 21, 41, 60, 80, 100],
                numberOfAdSpots;

            if (results != null && results.length > 0 && gamesContainer != null) {
                if (sortProperty) {
                    results.sort(this.compareTitle);
                }
                if (maxItems == null || maxItems < 1) {
                    maxItems = results.length;
                }
                countOfGamesShown = 0;
                adsShownCounter = 0;
                numberOfAdSpots = adsDisplayPositions.length;
                for (i = 0; i < results.length && countOfGamesShown < maxItems; i ++) {
                    gameItem = results[i];
                    if (isTouchDevice && ! (gameItem.game_plugin_id == "10" || gameItem.game_plugin_id == "9")) {
                        continue; // only show HTML5 or embed games on touch devices
                    }
                    countOfGamesShown ++;
                    isFavorite = false;
                    itemHtml = this.makeGameModule(gameItem.game_id, gameItem.title, gameItem.short_desc, baseURL + gameItem.game_name + "/images/300x225.png", "/play/?id=" + gameItem.game_id, isFavorite);
                    newDiv = document.createElement('div');
                    newDiv.className = "col-sm-6 col-md-4";
                    newDiv.innerHTML = itemHtml;
                    gamesContainer.appendChild(newDiv);
                    if (adsShownCounter < numberOfAdSpots && i + 1 == adsDisplayPositions[adsShownCounter]) {
                        // Time to show an ad module
                        adsShownCounter ++;
                        newDiv = document.createElement('div');
                        newDiv.className = "col-sm-6 col-md-4";
                        if (adsShownCounter == 1) {
                            newDiv.innerHTML = this.makeCouponModule();
                        } else {
                            newDiv.innerHTML = this.makeAdModule();
                        }
                        newDiv.id = 'AdSpot' + adsShownCounter;
                        gamesContainer.appendChild(newDiv);
                    }
                }
            } else {
                // no games!
            }
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
                if (succeeded == 0) {
                    console.log("Enginesis service error " + errorMessage + " from fn " + enginesisResponse.fn);
                }
                switch (enginesisResponse.fn) {
                    case "NewsletterAddressAssign":
                        this.handleNewsletterServerResponse(succeeded, errorMessage);
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
                            this.gameListGamesResponse(results.result, fillDiv, null, null);
                        }
                        break;

                    case "UserLoginCoreg":
                        var userInfo = null;
                        if (results.result !== undefined) {
                            if (results.result.row !== undefined) {
                                userInfo = results.result.row;
                            } else {
                                userInfo = results.result;
                            }
                        }
                        if (userInfo) {
                            // User is now logged in, refresh the page and the page refresh should be able to pick up the logged in state.
                            document.location.href = "/profile/?action=completelogin&network_id=" + getNetworkId();
                        } else {
                            // TODO: User is not logged in, we should display an error message.
                            varynApp.showInfoMessagePopup("Login", "There was a system issue while trying to login or register your account: " + errorMessage, 0);
                        }
                        break;

                    case 'RegisteredUserRequestPasswordChange':
                        if (succeeded == 1) {
                            varynApp.showInfoMessagePopup("Change Password", "A request to change your password has been sent to the email address on file. Please continue the password reset process from the link provided there.", 0);
                        } else {
                            if (results.status.extended_info != undefined) {
                                errorMessage += ' ' + results.status.extended_info;
                            }
                            varynApp.showInfoMessagePopup("Change Password", "There was a system issue while trying to reset your password: " + errorMessage, 0);
                        }
                        break;

                    case "PromotionItemList":
                        if (succeeded == 1) {
                            varynApp.showHomePagePromotionModule(results.result);
                        } else {
                            if (results.status.extended_info != undefined) {
                                errorMessage += ' ' + results.status.extended_info;
                            }
                            varynApp.showInfoMessagePopup("System error", "There was a system issue while trying to load the home page: " + errorMessage, 0);
                        }
                        break;

                    default:
                        console.log("Unhandled Enginesis reply for " + enginesisResponse.fn);
                        break;
                }
            }
        },
    }
};

/**
 * Determine full extent of the window available to the application
 * Extra Warning: this function must be global (on window object) because we will refer to it globally later.
 * @param container {string} id of DOM element that extends the full width and height of the page (use body unless you have a
 * full size div container.) container = "gameContainer";
 * @returns {object} {fullWidth, fullHeight}
 */
function getDocumentSize (container) {
    var gameContainerDiv = document.getElementById(container),
        result = {fullWidth: document.documentElement.clientWidth, fullHeight: document.documentElement.clientHeight},
        enginesisSession = varyn.getEnginesisSession();

    if (gameContainerDiv == null) {
        gameContainerDiv = document.body;
    }
    if (gameContainerDiv != null) {
        result.containerWidth = gameContainerDiv.clientWidth;
        result.containerHeight = gameContainerDiv.clientHeight;
    }
    if (enginesisSession != null) {
        result.gameWidth = enginesisSession.gameWidth;
        result.gameHeight = enginesisSession.gameHeight;
        result.gameAspectRatio = enginesisSession.gameAspectRatio;
    }
    return result;
}
