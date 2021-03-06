/**
 * Single Sign On (SSO) for Facebook.
 * When this module loads, we immediately check if we have a logged in user with Facebook.
 * 
 * @dependencies:
 * enginesis
 * commonUtilties
 */

(function ssoFacebook (global) {
    "use strict";
    var ssoFacebook = {},
        _debug = true,
        _networkId = 2,
        _applicationId = null,
        _SDKVersion = "v6.0",
        _scope = "email",
        _initialized = false, // true when FB.init has been run
        _loaded = false,  // true when SDK framework is loaded and ready to use
        _loading = false, // true only while loading the SDK framework
        _facebookTokenExpiration = null, // According to Facebook, this is a Unix timestamp.
        _facebookToken = null,
        _facebookSignedRequest = null,
        _callbackWhenLoaded = null,
        _callbackWhenLoggedIn = null,
        _callbackWhenLoggedOut = null,
        _userInfo = null;

    ssoFacebook.debugLog = function (message) {
        if (_debug) {
            console.log("ssoFacebook: " + message);
        }
    };

    /**
     * Define the data structure for what a logged in user shoud look like. This
     * is common to all SSO modules.
     */
    ssoFacebook.clearUserInfo = function () {
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
     * @param {object} parameters required to configure the service on behalf of the app.
     * @returns {boolean}
     */
    ssoFacebook.setParameters = function (parameters) {
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
        }
        return errors;
    };

    /**
     * Initialize the library and prepare it for use. This is called from the Facebook load callback. When loaded
     * we immediately check to see if we already have a logged in user.
     * 
     * @returns {boolean}
     */
    ssoFacebook.init = function () {
        _loading = false;
        ssoFacebook.clearUserInfo();
        if (global.FB && _applicationId) {
            var FB = global.FB;
            _loaded = true;
            FB.init({
                appId: _applicationId,
                cookie: true,
                xfbml: true,
                version: _SDKVersion
            });
            _initialized = true;
            FB.AppEvents.logPageView();
            if (typeof(_callbackWhenLoaded) === "function") {
                this.getLoginStatus().then(_callbackWhenLoaded, _callbackWhenLoaded);
                _callbackWhenLoaded = null;
            }
        }
        return _initialized;
    };

    /**
     * Load the Facebook SDK. This function must be called on any page that requires knowing if a user
     * is currently logged in with Facebook or any other Facebook services. Once loaded the Facebook SDK
     * calls its own callback `fbAsyncInit()`, which then calls our callback `init()`.
     * 
     * Example:
     *   ssoFacebook.load(parameters).then(function(result) { console.log('Facebook loaded'); }, function(error) { console.log('Facebook load failed ' + error.message); });
     * 
     * @param {object} parameters to configure our Facebook application. See `setParameters()`.
     * @returns {Promise}
     */
    ssoFacebook.load = function (parameters) {
        if (global.FB) {
            _loaded = true;
        }
        if ( ! _loading && ! _loaded) {
            _loaded = false;
            _loading = true;
            global.fbAsyncInit = ssoFacebook.init.bind(ssoFacebook);
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
                js.type = "text/javascript";
                js.async = true;
                js.src = scriptSource;
                fjs.parentNode.insertBefore(js, fjs);
                // once loaded Facebook SDK automatically calls window.fbAsyncInit()
            }(document, "script", "facebook-jssdk", "https://connect.facebook.net/en_US/sdk.js"));
        } else if (_loaded && ! _initialized) {
            this.init();
        }
    };

    /**
     * This is a "shortcut" to loading the Facebook SDK and getting the users current status. Because all these things
     * take time, we tried to pull everything together in a single function that could take quite a long time to
     * resolve.
     *
     * This function returns a promise that will resolve to a function that is called with the user's Facebook info
     * in the standard Enginesis object format. If the promise fails the function is called with an Error object.
     *
     * @param {object} parameters to configure our Facebook application. See `setParameters()`.
     * @returns {Promise}
     */
    ssoFacebook.loadThenLogin = function (parameters) {
        var ssoFacebookContext = this;
        return new Promise(function(resolve) {
            if (ssoFacebookContext.isReady()) {
                ssoFacebookContext.getLoginStatus().then(resolve, resolve);
            } else {
                ssoFacebookContext.debugLog("Facebook SDK is not loaded");
                _callbackWhenLoaded = resolve;
                ssoFacebookContext.load(parameters);
            }
        });
    };

    /**
     * Determine if the Facebook API is ready for action.
     * @returns {boolean}
     */
    ssoFacebook.isReady = function () {
        return _loaded && _initialized && global.FB;
    };

    /**
     * Return the Enginesis network id for this SSO provider.
     * @returns {number}
     */
    ssoFacebook.networkId = function () {
        return _networkId;
    };

    /**
     * Return the provider-based user-id which is the unique user id for this provider.
     * @returns {string} User id or empty string if no uer is logged in.
     */
    ssoFacebook.siteUserId = function () {
        return _userInfo ? _userInfo.siteUserId : "";
    };

    /**
     * Return the complete user info object, of null if no user is logged in.
     * @returns {
            networkId: Number,
            userName: string,
            realName: string,
            email: string,
            userId: number,
            siteUserId: string,
            siteUserToken: string,
            gender: string,
            dob: Date,
            avatarURL: string,
            scope: string
     * }
     */
    ssoFacebook.userInfo = function () {
        return _userInfo;
    };

    /**
     * Return the networks user token.
     * @returns {*}
     */
    ssoFacebook.token = function () {
        return _facebookToken;
    };

    /**
     * Return the networks' user token expiration time as a JavaScript date object.
     * This could be unixtimestamp(0) if the token is invaild or if no user is logged in.
     * @returns {Date} Date the token will be expired.
     */
    ssoFacebook.tokenExpirationDate = function () {
        return new Date(_facebookTokenExpiration * 1000);
    };

    /**
     * Return true if the network user token has expired or is invalid. If the token is valid and not expired this function returns false.
     * @returns {boolean}
     */
    ssoFacebook.isTokenExpired = function () {
        var timeDelta = (_facebookTokenExpiration * 1000) - Date.now();
        return timeDelta < 0;
    };

    /**
     * Check if the user's token has expired, and if it has attempt to refresh it. This
     * function returns immediately and if a refresh is required then the call back function
     * is called once that process has completed.
     * 
     * @param {function} callBackWhenComplete A callback function to call when the refresh is complete.
     * @returns {boolean} `true` if expired and a refresh is in progress, otherwise `false`.
     */
    ssoFacebook.refreshIfTokenExpired = function (callBackWhenComplete) {
        if (ssoFacebook.isTokenExpired()) {
            // TODO: What is the facebook API to refresh?
            return true;
        } else {
            return false;
        }
    };

    /**
     * When Facebook responds with a login request verify the user is logged in
     * and set the internal state.
     * 
     * @param {object} facebookResponse The response objectreturned from the Facebook login request.
     * @param {function} callBackWhenComplete A callback function to call when the internal state is set up. This function is called with the user attributes.
     */
    ssoFacebook.setLoginStatus = function (facebookResponse, callBackWhenComplete) {
        var ssoFacebookContext = this;
        if (facebookResponse) {
            var facebookStatus = facebookResponse.status;
            if (facebookStatus === "connected") {
                // Logged in to Facebook and authorized Varyn.
                var authResponse = facebookResponse.authResponse;
                _facebookToken = authResponse.accessToken;
                _facebookTokenExpiration = authResponse.expiresIn;
                _facebookSignedRequest = authResponse.signedRequest;
                _userInfo.siteUserId = authResponse.userID;
                global.FB.api("/me", "get", {fields: "id,name,email,gender"}, function (response) {
                    _userInfo = {
                        networkId: _networkId,
                        userName: response.name,
                        realName: response.name,
                        email: response.email || "",
                        siteUserId: response.id,
                        siteUserToken: response.id,
                        gender: enginesis.validGender(response.gender),
                        dob: commonUtilities.MySQLDate(commonUtilities.subtractYearsFromNow(14)),
                        avatarURL: "https://graph.facebook.com/" + response.id + "/picture?type=square",
                        scope: _scope
                    };
                    // if we get here, the user has approved our app AND they are logged in.
                    // We need to check this state IF a user is not currently logged in, this would indicate they should be logged in
                    // automatically with Facebook
                    ssoFacebookContext.debugLog("Successful Facebook login for: " + response.name + " (" + response.id + ")");
                    if (typeof(callBackWhenComplete) === "function") {
                        callBackWhenComplete(_userInfo);
                    }
                });
            } else {
                ssoFacebookContext.debugLog("no one logged in with Facebook status: " + facebookStatus);
                if (typeof(callBackWhenComplete) === "function") {
                    callBackWhenComplete(null);
                }
            }
        }
    };

    /**
     * Determine if we have a logged in user according to Facebook's SDK. This function returns a Promise, that
     * will resolve once the status can be determined, since usually this requires a network call and some delay
     * to figure it out.
     * @returns {Promise} Resolve function is called with the _userInfo object. Reject is called if no user is logged in.
     */
    ssoFacebook.getLoginStatus = function () {
        var ssoFacebookContext = this;
        return new Promise(function(resolve, reject) {
            if (global.FB !== undefined && _loaded) {
                global.FB.getLoginStatus(function(facebookResponse) {
                    ssoFacebookContext.setLoginStatus(facebookResponse, resolve);
                });
            } else {
                var errorMessage = "Facebook SDK does not appear to be loaded";
                ssoFacebookContext.debugLog(errorMessage);
                reject(Error(errorMessage));
            }
        });
    };

    /**
     * This callback handles Facebook's reply from a status request to see if a user is properly logged in.
     * @param facebookResponse {object} defined over at Facebook SDK
     * When a user is not logged in with Facebook and we would like the user
     * to use Facebook to authenticate and authoize our app, use this flow.
     * This is an async function and will return immediately, and then call
     * `callBackWhenComplete` when log in has completed.
     * 
     * @param {Function} callBackWhenComplete the function to call once log in is complete.
     */
    ssoFacebook.statusChangeCallback = function (facebookResponse) {
        ssoFacebook.setLoginStatus(facebookResponse, _callbackWhenLoggedIn);
    };

    /**
     * When a user is not logged in with Facebook and we would like the user
     * to use Facebook to authenticate and authoize our app, use this flow.
     * This is an async function and will return immediately, and then call
     * `callBackWhenComplete` when log in has completed.
     * 
     * @param {object} parameters to configure our Facebook application. See `setParameters()`.
     * @param {Function} callBackWhenComplete the function to call once log in is complete.
     */
    ssoFacebook.login = function (parameters, callBackWhenComplete) {
        // start the user login process.
        if (global.FB === undefined) {
            this.loadThenLogin(parameters).then(callBackWhenComplete);
        } else {
            global.FB.login(function(facebookResponse) {
                ssoFacebook.setLoginStatus(facebookResponse, callBackWhenComplete);
            }, {scope: _scope, return_scopes: true});
        }
    };

    /**
     * Cause the user to fully logout from Facebook such that no cookies or local data persist.
     * @param {Function} callBackWhenComplete function to call when log out is complete.
     */
    ssoFacebook.logout = function (callBackWhenComplete) {
        if (typeof(callBackWhenComplete) === "function") {
            callBackWhenComplete(null);
        }
    };

    /**
     * Disconnect the user from Facebook which should invoke a full user delete.
     * @param callBackWhenComplete
     */
    ssoFacebook.disconnect = function (callBackWhenComplete) {
        if (typeof(callBackWhenComplete) === "function") {
            callBackWhenComplete(null);
        }
    };

    /* ----------------------------------------------------------------------------------
     * Setup for AMD, node, or standalone reference the commonUtilities object.
     * ----------------------------------------------------------------------------------*/

    if (typeof define === "function" && define.amd) {
        define(function () { return ssoFacebook; });
    } else if (typeof exports === "object") {
        module.exports = ssoFacebook;
    } else {
        var existingFunctions = global.ssoFacebook;
        ssoFacebook.existingFunctions = function () {
            global.ssoFacebook = existingFunctions;
            return this;
        };
        global.ssoFacebook = ssoFacebook;
    }
    ssoFacebook.clearUserInfo();
})(this);
