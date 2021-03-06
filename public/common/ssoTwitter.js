/**
 * Single Sign On for Twitter
 * Twitter login is mostly done with PHP, then if the twitter token is attained we can use that in JavaScript.
 * Login is completed in /procs/oauth.php.
 */

(function ssoTwitter (global) {
    "use strict";
    var ssoTwitter = {},
        _debug = true,
        _networkId = 11,
        _siteUserId = "",
        _applicationId = "",
        _SDKVersion = "",
        _initialized = false,
        _scope = "email",
        _loading = false,
        _loaded = false,
        _tokenExpiration = null,
        _token = null,
        _callbackWhenLoaded = null,
        _callbackWhenLoggedIn = null,
        _callbackWhenLoggedOut = null,
        _userInfo = null,
        _redirectPage = null;

    ssoTwitter.debugLog = function (message) {
        if (_debug) {
            console.log("ssoTwitter: " + message);
        }
    };

    /**
     * Define the data structure for what a logged in user shoud look like. This
     * is common to all SSO modules.
     */
    ssoTwitter.clearUserInfo = function () {
        _userInfo = {
            networkId: _networkId,
            userName: "",
            realName: "",
            email: "",
            userId: "",
            siteUserId: "",
            siteUserToken: "",
            gender: "U",
            dob: null,
            avatarURL: "",
            scope: _scope
        };
    };

    /**
     * Initialize the library and prepare it for use.
     * 
     * @param {object} parameters to configure our Twitter application.
     * @returns {boolean}
     */
    ssoTwitter.setParameters = function (parameters) {
        var errors = null;
        if (parameters) {
            if (parameters.networkId) {
                _networkId = parameters.networkId;
            }
            if (parameters.applicationId) {
                _applicationId = parameters.applicationId;
            }
            if (parameters.SDKVersion) {
                _SDKVersion = parameters.SDKVersion;
            }
            if (parameters.scope) {
                _scope = parameters.scope;
            }
            if (parameters.loadCallback) {
                _callbackWhenLoaded = parameters.loadCallback;
            }
            if (parameters.loginCallback) {
                _callbackWhenLoggedIn = parameters.loginCallback;
            }
            if (parameters.logoutCallback) {
                _callbackWhenLoggedOut = parameters.logoutCallback;
            }
            if (parameters.redirectPage) {
                _redirectPage = parameters.redirectPage;
            }
        }
        return errors;
    };

    /**
     * Initialize the library and prepare it for use. This is called from the Twitter SDK load callback.
     * @returns {boolean}
     */
    ssoTwitter.init = function () {
        _loading = false;
        _loaded = true;
        ssoTwitter.clearUserInfo();
        if (typeof(_callbackWhenLoaded) === "function") {
            var callback = _callbackWhenLoaded;
            _callbackWhenLoaded = null;
            callback(null);
        }
        return _initialized;
    };

    /**
     * Load the Twitter library. This function must be called on any page that requires knowing if a user
     * is currently logged in with Twitter or any other Twitter services. Once loaded, the Twitter SDK
     * calls window.twitterInit which then calls the provided parameters.loadCallback function.
     * Example:
     *   ssoTwitter.load(parameters).then(function(result) { console.log('Twitter loaded'); }, function(error) { console.log('Twitter load failed ' + error.message); });
     * 
     * @param {object} parameters to configure the Twitter application. See setParameters().
     */
    ssoTwitter.load = function (parameters) {
        if (!_loaded) {
            _loaded = false;
            _loading = true;
            global.twitterInit = this.init.bind(this);
            this.setParameters(parameters);
            (function (d, s, id, scriptSource) {
                var js, fjs;
                if (d.getElementById(id)) {
                    return;
                }
                fjs = d.getElementsByTagName(s)[0];
                if (fjs == null) {
                    fjs = d.getElementsByTagName("div")[0];
                }
                js = d.createElement(s);
                js.id = id;
                js.src = scriptSource;
                js.onload = function() {
                    ssoTwitter._loaded = true;
                    ssoTwitter.init();
                };
                fjs.parentNode.insertBefore(js, fjs);
            }(document, "script", "twitter-jssdk", "https://platform.twitter.com/widgets.js"));
        } else if (!_initialized) {
            this.init();
        }
    };

    /**
     * This is a "shortcut" to loading the Twitter SDK and getting the users current status. Because all these things
     * take time, we tried to pull everything together in a single function that could take quite a long time to
     * resolve.
     *
     * This function returns a promise that will resolve to a function that is called with the user's Twitter info
     * in the standard Enginesis object format. If the promise fails the function is called with an Error object.
     *
     * @param {object} parameters same parameters you pass to load().
     * @returns {Promise}
     */
    ssoTwitter.loadThenLogin = function (parameters) {
        var ssoTwitterInstance = this;
        return new Promise(function(resolve) {
            if (ssoTwitterInstance.isReady()) {
                ssoTwitterInstance.getLoginStatus().then(resolve, resolve);
            } else {
                _callbackWhenLoaded = resolve;
                ssoTwitterInstance.load(parameters);
            }
        });
    };

    /**
     * Determine if the Twitter API is ready for action.
     * @returns {boolean}
     */
    ssoTwitter.isReady = function () {
        return _loaded && _initialized;
    };

    /**
     * Return the Enginesis network id for Twitter.
     * @returns {number}
     */
    ssoTwitter.networkId = function () {
        return _networkId;
    };

    /**
     * Return the Enginesis site-user-id which is the unique user id for this network.
     * @returns {string}
     */
    ssoTwitter.siteUserId = function () {
        return _siteUserId;
    };

    /**
     * Return the complete user info object, of null if no user is logged in.
     * @returns {{userName: string, realName: string, userId: string, networkId: number, siteUserId: string, dob: null, gender: string, avatarURL: string}}
     */
    ssoTwitter.userInfo = function () {
        return _userInfo;
    };

    /**
     * Return the networks user token.
     * @returns {*}
     */
    ssoTwitter.token = function () {
        return _token;
    };

    /**
     * Return the networks user token expiration date as a JavaScript date object. This could be null if the token
     * is invaid or if no user is logged in.
     * @returns {Date} Date the token will be expired.
     */
    ssoTwitter.tokenExpirationDate = function () {
        return new Date(_tokenExpiration * 1000);
    };

    /**
     * Return true if the network user token has expired or is invalid. If the token is valid and not expired this function returns false.
     * @returns {boolean}
     */
    ssoTwitter.isTokenExpired = function () {
        var timeDelta = (_tokenExpiration * 1000) - Date.now();
        return timeDelta < 0;
    };

    /**
     * Determine if we have a logged in user according to the rules of this network. This function returns a Promise, that
     * will resolve once the status can be determined, since usually this requires a network call and some delay to figure it out.
     */
    ssoTwitter.getLoginStatus = function () {
    };

    /**
     * To start a Twitter login, redirect to the server page that makes the OAuth request.
     * If the user is logged in then that page will have to redirect back to this page
     * with the user's authentication token saved in a cookie.
     * 
     * @param {Function} callBackWhenComplete the function to call once log in is complete.
     */
    ssoTwitter.login = function (callBackWhenComplete) {
        var oauthURL = "/procs/oauth.php?action=login&provider=twitter";
        if (_redirectPage != null) {
            oauthURL += "&redirect=" + _redirectPage;
        }
        document.location = oauthURL;
    };

    /**
     * Cause the user to fully logout from Twitter such that no cookies or local data persist.
     * @param callBackWhenComplete
     */
    ssoTwitter.logout = function (callBackWhenComplete) {
    };

    /**
     * Disconnect the user from Twitter which should invoke a full user delete.
     * @param callBackWhenComplete
     */
    ssoTwitter.disconnect = function (callBackWhenComplete) {
    };


    /* ----------------------------------------------------------------------------------
     * Setup for AMD, node, or standalone reference the commonUtilities object.
     * ----------------------------------------------------------------------------------*/

    if (typeof define === "function" && define.amd) {
        define(function () { return ssoTwitter; });
    } else if (typeof exports === "object") {
        module.exports = ssoTwitter;
    } else {
        var existingFunctions = global.ssoTwitter;
        ssoTwitter.existingFunctions = function () {
            global.ssoTwitter = existingFunctions;
            return this;
        };
        global.ssoTwitter = ssoTwitter;
    }
})(this);
