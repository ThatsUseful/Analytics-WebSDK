//
//  Copyright 2017 mParticle, Inc.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
//
//  Uses portions of code from jQuery
//  jQuery v1.10.2 | (c) 2005, 2013 jQuery Foundation, Inc. | jquery.org/license

var Polyfill = require('./polyfill'),
    Types = require('./types'),
    Constants = require('./constants'),
    Helpers = require('./helpers'),
    NativeSdkHelpers = require('./nativeSdkHelpers'),
    CookieSyncManager = require('./cookieSyncManager'),
    SessionManager = require('./sessionManager'),
    Ecommerce = require('./ecommerce'),
    MP = require('./mp'),
    Persistence = require('./persistence'),
    getDeviceId = Persistence.getDeviceId,
    Events = require('./events'),
    Messages = Constants.Messages,
    Validators = Helpers.Validators,
    Migrations = require('./migrations'),
    Forwarders = require('./forwarders'),
    ForwardingStatsUploader = require('./forwardingStatsUploader'),
    IdentityRequest = require('./identity').IdentityRequest,
    Identity = require('./identity').Identity,
    IdentityAPI = require('./identity').IdentityAPI,
    HTTPCodes = IdentityAPI.HTTPCodes,
    mParticleUserCart = require('./identity').mParticleUserCart,
    mParticleUser = require('./identity').mParticleUser,
    Consent = require('./consent');

(function(window) {
    if (!Array.prototype.forEach) {
        Array.prototype.forEach = Polyfill.forEach;
    }

    if (!Array.prototype.map) {
        Array.prototype.map = Polyfill.map;
    }

    if (!Array.prototype.filter) {
        Array.prototype.filter = Polyfill.filter;
    }

    if (!Array.isArray) {
        Array.prototype.isArray = Polyfill.isArray;
    }

    /**
    * Invoke these methods on the mParticle object.
    * Example: mParticle.endSession()
    *
    * @class mParticle
    */

    var mParticle = {
        useNativeSdk: window.mParticle && window.mParticle.useNativeSdk ? window.mParticle.useNativeSdk : false,
        isIOS: window.mParticle && window.mParticle.isIOS ? window.mParticle.isIOS : false,
        isDevelopmentMode: false,
        useCookieStorage: false,
        maxProducts: Constants.DefaultConfig.MaxProducts,
        maxCookieSize: Constants.DefaultConfig.MaxCookieSize,
        integrationDelayTimeout: Constants.DefaultConfig.IntegrationDelayTimeout,
        identifyRequest: {},
        getDeviceId: getDeviceId,
        generateHash: Helpers.generateHash,
        sessionManager: SessionManager,
        cookieSyncManager: CookieSyncManager,
        persistence: Persistence,
        migrations: Migrations,
        Identity: IdentityAPI,
        Validators: Validators,
        _Identity: Identity,
        _IdentityRequest: IdentityRequest,
        IdentityType: Types.IdentityType,
        EventType: Types.EventType,
        CommerceEventType: Types.CommerceEventType,
        PromotionType: Types.PromotionActionType,
        ProductActionType: Types.ProductActionType,
        /**
        * Initializes the mParticle SDK
        *
        * @method init
        * @param {String} apiKey your mParticle assigned API key
        * @param {Object} [options] an options object for additional configuration
        */
        init: function(apiKey) {
            MP.webviewBridgeEnabled = NativeSdkHelpers.isWebviewEnabled(mParticle.requiredWebviewBridgeName, mParticle.minWebviewBridgeVersion);

            if (MP.webviewBridgeEnabled) {
                NativeSdkHelpers.sendToNative(Constants.NativeSdkPaths.SetSessionAttribute, JSON.stringify({ key: '$src_env', value: 'webview' }));
                if (apiKey) {
                    NativeSdkHelpers.sendToNative(Constants.NativeSdkPaths.SetSessionAttribute, JSON.stringify({ key: '$src_key', value: apiKey}));
                }
            } else {
                var config, currentUser;

                MP.storageName = Helpers.createMainStorageName(mParticle.workspaceToken);
                MP.prodStorageName = Helpers.createProductStorageName(mParticle.workspaceToken);

                MP.integrationDelayTimeoutStart = Date.now();
                MP.initialIdentifyRequest = mParticle.identifyRequest;
                MP.devToken = apiKey || null;
                Helpers.logDebug(Messages.InformationMessages.StartingInitialization);
                //check to see if localStorage is available for migrating purposes
                MP.isLocalStorageAvailable = Persistence.determineLocalStorageAvailability(window.localStorage);

                // Set configuration to default settings
                Helpers.mergeConfig({});

                // Migrate any cookies from previous versions to current cookie version
                Migrations.migrate();

                // Load any settings/identities/attributes from cookie or localStorage
                Persistence.initializeStorage();

                // If no identity is passed in, we set the user identities to what is currently in cookies for the identify request
                if ((Helpers.isObject(mParticle.identifyRequest) && Object.keys(mParticle.identifyRequest).length === 0) || !mParticle.identifyRequest) {
                    var modifiedUIforIdentityRequest = {};
                    for (var identityType in MP.userIdentities) {
                        if (MP.userIdentities.hasOwnProperty(identityType)) {
                            modifiedUIforIdentityRequest[Types.IdentityType.getIdentityName(Helpers.parseNumber(identityType))] = MP.userIdentities[identityType];
                        }
                    }

                    MP.initialIdentifyRequest = {
                        userIdentities: modifiedUIforIdentityRequest
                    };
                } else {
                    MP.initialIdentifyRequest = mParticle.identifyRequest;
                }

                // If migrating from pre-IDSync to IDSync, a sessionID will exist and an identify request will not have been fired, so we need this check
                if (MP.migratingToIDSyncCookies) {
                    IdentityAPI.identify(MP.initialIdentifyRequest, mParticle.identifyRequest);
                    MP.migratingToIDSyncCookies = false;
                }

                currentUser = IdentityAPI.getCurrentUser();
                // Call MP.config.identityCallback when identify was not called due to a reload or a sessionId already existing
                if (!MP.identifyCalled && mParticle.identityCallback && MP.mpid && currentUser) {
                    mParticle.identityCallback({
                        httpCode: HTTPCodes.activeSession,
                        getUser: function() {
                            return mParticleUser(MP.mpid);
                        },
                        body: {
                            mpid: MP.mpid,
                            is_logged_in: MP.isLoggedIn,
                            matched_identities: currentUser ? currentUser.getUserIdentities().userIdentities : {},
                            context: null,
                            is_ephemeral: false
                        }
                    });
                }

                Forwarders.initForwarders(MP.initialIdentifyRequest.userIdentities);
                if (Helpers.hasFeatureFlag(Constants.Features.Batching)) {
                    ForwardingStatsUploader.startForwardingStatsTimer();
                }

                if (arguments && arguments.length) {
                    if (arguments.length > 1 && typeof arguments[1] === 'object') {
                        config = arguments[1];
                    }
                    if (config) {
                        Helpers.mergeConfig(config);
                    }
                }

                SessionManager.initialize();
                Events.logAST();
            }

            // Call any functions that are waiting for the library to be initialized
            if (MP.readyQueue && MP.readyQueue.length) {
                MP.readyQueue.forEach(function(readyQueueItem) {
                    if (Validators.isFunction(readyQueueItem)) {
                        readyQueueItem();
                    } else if (Array.isArray(readyQueueItem)) {
                        processPreloadedItem(readyQueueItem);
                    }
                });

                MP.readyQueue = [];
            }
            MP.isInitialized = true;
        },
        /**
        * Completely resets the state of the SDK. mParticle.init(apiKey) will need to be called again.
        * @method reset
        * @param {Boolean} keepPersistence if passed as true, this method will only reset the in-memory SDK state.
        */
        reset: function(keepPersistence) {
            MP.sessionAttributes = {};
            MP.isEnabled = true;
            MP.isFirstRun = null;
            Events.stopTracking();
            MP.devToken = null;
            MP.sessionId = null;
            MP.appName = null;
            MP.appVersion = null;
            MP.currentSessionMPIDs = [],
            MP.eventQueue = [];
            MP.context = null;
            MP.userAttributes = {};
            MP.userIdentities = {};
            MP.cookieSyncDates = {};
            MP.activeForwarders = [];
            MP.configuredForwarders = [];
            MP.forwarderConstructors = [];
            MP.pixelConfigurations = [];
            MP.cartProducts = [];
            MP.serverSettings = null;
            MP.mpid = null;
            MP.customFlags = null;
            MP.currencyCode;
            MP.clientId = null;
            MP.deviceId = null;
            MP.dateLastEventSent = null;
            MP.sessionStartDate = null;
            MP.watchPositionId = null;
            MP.readyQueue = [];
            MP.migrationData = {};
            MP.identityCallInFlight = false;
            MP.initialIdentifyRequest = null;
            MP.isInitialized = false;
            MP.identifyCalled = false;
            MP.consentState = null;
            MP.featureFlags = {};
            MP.integrationAttributes = {};
            MP.integrationDelays = {};
            MP.requireDelay = true;
            Helpers.mergeConfig({});
            if (!keepPersistence) {
                Persistence.resetPersistence();
            }
            mParticle.identityCallback = null;
            Persistence.forwardingStatsBatches.uploadsTable = {};
            Persistence.forwardingStatsBatches.forwardingStatsEventQueue = [];
        },
        ready: function(f) {
            if (MP.isInitialized && typeof f === 'function') {
                f();
            }
            else {
                MP.readyQueue.push(f);
            }
        },
        /**
        * Returns the mParticle SDK version number
        * @method getVersion
        * @return {String} mParticle SDK version number
        */
        getVersion: function() {
            return Constants.sdkVersion;
        },
        /**
        * Sets the app version
        * @method setAppVersion
        * @param {String} version version number
        */
        setAppVersion: function(version) {
            MP.appVersion = version;
            Persistence.update();
        },
        /**
        * Gets the app name
        * @method getAppName
        * @return {String} App name
        */
        getAppName: function() {
            return MP.appName;
        },
        /**
        * Sets the app name
        * @method setAppName
        * @param {String} name App Name
        */
        setAppName: function(name) {
            MP.appName = name;
        },
        /**
        * Gets the app version
        * @method getAppVersion
        * @return {String} App version
        */
        getAppVersion: function() {
            return MP.appVersion;
        },
        /**
        * Stops tracking the location of the user
        * @method stopTrackingLocation
        */
        stopTrackingLocation: function() {
            SessionManager.resetSessionTimer();
            Events.stopTracking();
        },
        /**
        * Starts tracking the location of the user
        * @method startTrackingLocation
        * @param {Function} [callback] A callback function that is called when the location is either allowed or rejected by the user. A position object of schema {coords: {latitude: number, longitude: number}} is passed to the callback
        */
        startTrackingLocation: function(callback) {
            if (!Validators.isFunction(callback)) {
                Helpers.logDebug('Warning: Location tracking is triggered, but not including a callback into the `startTrackingLocation` may result in events logged too quickly and not being associated with a location.');
            }

            SessionManager.resetSessionTimer();
            Events.startTracking(callback);
        },
        /**
        * Sets the position of the user
        * @method setPosition
        * @param {Number} lattitude lattitude digit
        * @param {Number} longitude longitude digit
        */
        setPosition: function(lat, lng) {
            SessionManager.resetSessionTimer();
            if (typeof lat === 'number' && typeof lng === 'number') {
                MP.currentPosition = {
                    lat: lat,
                    lng: lng
                };
            }
            else {
                Helpers.logDebug('Position latitude and/or longitude must both be of type number');
            }
        },
        /**
        * Starts a new session
        * @method startNewSession
        */
        startNewSession: function() {
            SessionManager.startNewSession();
        },
        /**
        * Ends the current session
        * @method endSession
        */
        endSession: function() {
            // Sends true as an over ride vs when endSession is called from the setInterval
            SessionManager.endSession(true);
        },
        /**
        * Logs an event to mParticle's servers
        * @method logEvent
        * @param {String} eventName The name of the event
        * @param {Number} [eventType] The eventType as seen [here](http://docs.mparticle.com/developers/sdk/javascript/event-tracking#event-type)
        * @param {Object} [eventInfo] Attributes for the event
        * @param {Object} [customFlags] Additional customFlags
        */
        logEvent: function(eventName, eventType, eventInfo, customFlags) {
            SessionManager.resetSessionTimer();
            if (typeof (eventName) !== 'string') {
                Helpers.logDebug(Messages.ErrorMessages.EventNameInvalidType);
                return;
            }

            if (!eventType) {
                eventType = Types.EventType.Unknown;
            }

            if (!Helpers.isEventType(eventType)) {
                Helpers.logDebug('Invalid event type: ' + eventType + ', must be one of: \n' + JSON.stringify(Types.EventType));
                return;
            }

            if (!Helpers.canLog()) {
                Helpers.logDebug(Messages.ErrorMessages.LoggingDisabled);
                return;
            }

            Events.logEvent(Types.MessageType.PageEvent, eventName, eventInfo, eventType, customFlags);
        },
        /**
        * Used to log custom errors
        *
        * @method logError
        * @param {String or Object} error The name of the error (string), or an object formed as follows {name: 'exampleName', message: 'exampleMessage', stack: 'exampleStack'}
        */
        logError: function(error) {
            SessionManager.resetSessionTimer();
            if (!error) {
                return;
            }

            if (typeof error === 'string') {
                error = {
                    message: error
                };
            }

            Events.logEvent(Types.MessageType.CrashReport,
                error.name ? error.name : 'Error',
                {
                    m: error.message ? error.message : error,
                    s: 'Error',
                    t: error.stack
                },
                Types.EventType.Other);
        },
        /**
        * Logs `click` events
        * @method logLink
        * @param {String} selector The selector to add a 'click' event to (ex. #purchase-event)
        * @param {String} [eventName] The name of the event
        * @param {Number} [eventType] The eventType as seen [here](http://docs.mparticle.com/developers/sdk/javascript/event-tracking#event-type)
        * @param {Object} [eventInfo] Attributes for the event
        */
        logLink: function(selector, eventName, eventType, eventInfo) {
            SessionManager.resetSessionTimer();
            Events.addEventHandler('click', selector, eventName, eventInfo, eventType);
        },
        /**
        * Logs `submit` events
        * @method logForm
        * @param {String} selector The selector to add the event handler to (ex. #search-event)
        * @param {String} [eventName] The name of the event
        * @param {Number} [eventType] The eventType as seen [here](http://docs.mparticle.com/developers/sdk/javascript/event-tracking#event-type)
        * @param {Object} [eventInfo] Attributes for the event
        */
        logForm: function(selector, eventName, eventType, eventInfo) {
            SessionManager.resetSessionTimer();
            Events.addEventHandler('submit', selector, eventName, eventInfo, eventType);
        },
        /**
        * Logs a page view
        * @method logPageView
        * @param {String} eventName The name of the event. Defaults to 'PageView'.
        * @param {Object} [attrs] Attributes for the event
        * @param {Object} [customFlags] Custom flags for the event
        */
        logPageView: function(eventName, attrs, customFlags) {
            SessionManager.resetSessionTimer();

            if (Helpers.canLog()) {
                if (!Validators.isStringOrNumber(eventName)) {
                    eventName = 'PageView';
                }
                if (!attrs) {
                    attrs = {
                        hostname: window.location.hostname,
                        title: window.document.title
                    };
                }
                else if (!Helpers.isObject(attrs)){
                    Helpers.logDebug('The attributes argument must be an object. A ' + typeof attrs + ' was entered. Please correct and retry.');
                    return;
                }
                if (customFlags && !Helpers.isObject(customFlags)) {
                    Helpers.logDebug('The customFlags argument must be an object. A ' + typeof customFlags + ' was entered. Please correct and retry.');
                    return;
                }
            }

            Events.logEvent(Types.MessageType.PageView, eventName, attrs, Types.EventType.Unknown, customFlags);
        },
        Consent: {
            createGDPRConsent: Consent.createGDPRConsent,
            createConsentState: Consent.createConsentState
        },
        /**
        * Invoke these methods on the mParticle.eCommerce object.
        * Example: mParticle.eCommerce.createImpresion(...)
        * @class mParticle.eCommerce
        */
        eCommerce: {
            /**
            * Invoke these methods on the mParticle.eCommerce.Cart object.
            * Example: mParticle.eCommerce.Cart.add(...)
            * @class mParticle.eCommerce.Cart
            */
            Cart: {
                /**
                * Adds a product to the cart
                * @method add
                * @param {Object} product The product you want to add to the cart
                * @param {Boolean} [logEventBoolean] Option to log the event to mParticle's servers. If blank, no logging occurs.
                */
                add: function(product, logEventBoolean) {
                    mParticleUserCart(MP.mpid).add(product, logEventBoolean);
                },
                /**
                * Removes a product from the cart
                * @method remove
                * @param {Object} product The product you want to add to the cart
                * @param {Boolean} [logEventBoolean] Option to log the event to mParticle's servers. If blank, no logging occurs.
                */
                remove: function(product, logEventBoolean) {
                    mParticleUserCart(MP.mpid).remove(product, logEventBoolean);
                },
                /**
                * Clears the cart
                * @method clear
                */
                clear: function() {
                    mParticleUserCart(MP.mpid).clear();
                }
            },
            /**
            * Sets the currency code
            * @for mParticle.eCommerce
            * @method setCurrencyCode
            * @param {String} code The currency code
            */
            setCurrencyCode: function(code) {
                if (typeof code !== 'string') {
                    Helpers.logDebug('Code must be a string');
                    return;
                }
                SessionManager.resetSessionTimer();
                MP.currencyCode = code;
            },
            /**
            * Creates a product
            * @for mParticle.eCommerce
            * @method createProduct
            * @param {String} name product name
            * @param {String} sku product sku
            * @param {Number} price product price
            * @param {Number} [quantity] product quantity. If blank, defaults to 1.
            * @param {String} [variant] product variant
            * @param {String} [category] product category
            * @param {String} [brand] product brand
            * @param {Number} [position] product position
            * @param {String} [coupon] product coupon
            * @param {Object} [attributes] product attributes
            */
            createProduct: function(name, sku, price, quantity, variant, category, brand, position, coupon, attributes) {
                SessionManager.resetSessionTimer();
                return Ecommerce.createProduct(name, sku, price, quantity, variant, category, brand, position, coupon, attributes);
            },
            /**
            * Creates a promotion
            * @for mParticle.eCommerce
            * @method createPromotion
            * @param {String} id a unique promotion id
            * @param {String} [creative] promotion creative
            * @param {String} [name] promotion name
            * @param {Number} [position] promotion position
            */
            createPromotion: function(id, creative, name, position) {
                SessionManager.resetSessionTimer();
                return Ecommerce.createPromotion(id, creative, name, position);
            },
            /**
            * Creates a product impression
            * @for mParticle.eCommerce
            * @method createImpression
            * @param {String} name impression name
            * @param {Object} product the product for which an impression is being created
            */
            createImpression: function(name, product) {
                SessionManager.resetSessionTimer();
                return Ecommerce.createImpression(name, product);
            },
            /**
            * Creates a transaction attributes object to be used with a checkout
            * @for mParticle.eCommerce
            * @method createTransactionAttributes
            * @param {String or Number} id a unique transaction id
            * @param {String} [affiliation] affilliation
            * @param {String} [couponCode] the coupon code for which you are creating transaction attributes
            * @param {Number} [revenue] total revenue for the product being purchased
            * @param {String} [shipping] the shipping method
            * @param {Number} [tax] the tax amount
            */
            createTransactionAttributes: function(id, affiliation, couponCode, revenue, shipping, tax) {
                SessionManager.resetSessionTimer();
                return Ecommerce.createTransactionAttributes(id, affiliation, couponCode, revenue, shipping, tax);
            },
            /**
            * Logs a checkout action
            * @for mParticle.eCommerce
            * @method logCheckout
            * @param {Number} step checkout step number
            * @param {Object} options
            * @param {Object} attrs
            * @param {Object} [customFlags] Custom flags for the event
            */
            logCheckout: function(step, options, attrs, customFlags) {
                SessionManager.resetSessionTimer();
                Events.logCheckoutEvent(step, options, attrs, customFlags);
            },
            /**
            * Logs a product action
            * @for mParticle.eCommerce
            * @method logProductAction
            * @param {Number} productActionType product action type as found [here](https://github.com/mParticle/mparticle-sdk-javascript/blob/master-v2/src/types.js#L206-L218)
            * @param {Object} product the product for which you are creating the product action
            * @param {Object} [attrs] attributes related to the product action
            * @param {Object} [customFlags] Custom flags for the event
            */
            logProductAction: function(productActionType, product, attrs, customFlags) {
                SessionManager.resetSessionTimer();
                Events.logProductActionEvent(productActionType, product, attrs, customFlags);
            },
            /**
            * Logs a product purchase
            * @for mParticle.eCommerce
            * @method logPurchase
            * @param {Object} transactionAttributes transactionAttributes object
            * @param {Object} product the product being purchased
            * @param {Boolean} [clearCart] boolean to clear the cart after logging or not. Defaults to false
            * @param {Object} [attrs] other attributes related to the product purchase
            * @param {Object} [customFlags] Custom flags for the event
            */
            logPurchase: function(transactionAttributes, product, clearCart, attrs, customFlags) {
                if (!transactionAttributes || !product) {
                    Helpers.logDebug(Messages.ErrorMessages.BadLogPurchase);
                    return;
                }
                SessionManager.resetSessionTimer();
                Events.logPurchaseEvent(transactionAttributes, product, attrs, customFlags);

                if (clearCart === true) {
                    mParticle.eCommerce.Cart.clear();
                }
            },
            /**
            * Logs a product promotion
            * @for mParticle.eCommerce
            * @method logPromotion
            * @param {Number} type the promotion type as found [here](https://github.com/mParticle/mparticle-sdk-javascript/blob/master-v2/src/types.js#L275-L279)
            * @param {Object} promotion promotion object
            * @param {Object} [attrs] boolean to clear the cart after logging or not
            * @param {Object} [customFlags] Custom flags for the event
            */
            logPromotion: function(type, promotion, attrs, customFlags) {
                SessionManager.resetSessionTimer();
                Events.logPromotionEvent(type, promotion, attrs, customFlags);
            },
            /**
            * Logs a product impression
            * @for mParticle.eCommerce
            * @method logImpression
            * @param {Object} impression product impression object
            * @param {Object} attrs attributes related to the impression log
            * @param {Object} [customFlags] Custom flags for the event
            */
            logImpression: function(impression, attrs, customFlags) {
                SessionManager.resetSessionTimer();
                Events.logImpressionEvent(impression, attrs, customFlags);
            },
            /**
            * Logs a refund
            * @for mParticle.eCommerce
            * @method logRefund
            * @param {Object} transactionAttributes transaction attributes related to the refund
            * @param {Object} product product being refunded
            * @param {Boolean} [clearCart] boolean to clear the cart after refund is logged. Defaults to false.
            * @param {Object} [attrs] attributes related to the refund
            * @param {Object} [customFlags] Custom flags for the event
            */
            logRefund: function(transactionAttributes, product, clearCart, attrs, customFlags) {
                SessionManager.resetSessionTimer();
                Events.logRefundEvent(transactionAttributes, product, attrs, customFlags);

                if (clearCart === true) {
                    mParticle.eCommerce.Cart.clear();
                }
            },
            expandCommerceEvent: function(event) {
                SessionManager.resetSessionTimer();
                return Ecommerce.expandCommerceEvent(event);
            }
        },
        /**
        * Sets a session attribute
        * @for mParticle
        * @method setSessionAttribute
        * @param {String} key key for session attribute
        * @param {String or Number} value value for session attribute
        */
        setSessionAttribute: function(key, value) {
            SessionManager.resetSessionTimer();
            // Logs to cookie
            // And logs to in-memory object
            // Example: mParticle.setSessionAttribute('location', '33431');
            if (Helpers.canLog()) {
                if (!Validators.isValidAttributeValue(value)) {
                    Helpers.logDebug(Messages.ErrorMessages.BadAttribute);
                    return;
                }

                if (!Validators.isValidKeyValue(key)) {
                    Helpers.logDebug(Messages.ErrorMessages.BadKey);
                    return;
                }

                if (MP.webviewBridgeEnabled) {
                    NativeSdkHelpers.sendToNative(Constants.NativeSdkPaths.SetSessionAttribute, JSON.stringify({ key: key, value: value }));
                } else {
                    var existingProp = Helpers.findKeyInObject(MP.sessionAttributes, key);

                    if (existingProp) {
                        key = existingProp;
                    }

                    MP.sessionAttributes[key] = value;
                    Persistence.update();

                    Forwarders.applyToForwarders('setSessionAttribute', [key, value]);
                }
            }
        },
        /**
        * Set opt out of logging
        * @for mParticle
        * @method setOptOut
        * @param {Boolean} isOptingOut boolean to opt out or not. When set to true, opt out of logging.
        */
        setOptOut: function(isOptingOut) {
            SessionManager.resetSessionTimer();
            MP.isEnabled = !isOptingOut;

            Events.logOptOut();
            Persistence.update();

            if (MP.activeForwarders.length) {
                MP.activeForwarders.forEach(function(forwarder) {
                    if (forwarder.setOptOut) {
                        var result = forwarder.setOptOut(isOptingOut);

                        if (result) {
                            Helpers.logDebug(result);
                        }
                    }
                });
            }
        },
        /**
        * Set or remove the integration attributes for a given integration ID.
        * Integration attributes are keys and values specific to a given integration. For example,
        * many integrations have their own internal user/device ID. mParticle will store integration attributes
        * for a given device, and will be able to use these values for server-to-server communication to services.
        * This is often useful when used in combination with a server-to-server feed, allowing the feed to be enriched
        * with the necessary integration attributes to be properly forwarded to the given integration.
        * @for mParticle
        * @method setIntegrationAttribute
        * @param {Number} integrationId mParticle integration ID
        * @param {Object} attrs a map of attributes that will replace any current attributes. The keys are predefined by mParticle.
        * Please consult with the mParticle docs or your solutions consultant for the correct value. You may
        * also pass a null or empty map here to remove all of the attributes.
        */
        setIntegrationAttribute: function(integrationId, attrs) {
            if (typeof integrationId !== 'number') {
                Helpers.logDebug('integrationId must be a number');
                return;
            }
            if (attrs === null) {
                MP.integrationAttributes[integrationId] = {};
            } else if (Helpers.isObject(attrs)) {
                if (Object.keys(attrs).length === 0) {
                    MP.integrationAttributes[integrationId] = {};
                } else {
                    for (var key in attrs) {
                        if (typeof key === 'string') {
                            if (typeof attrs[key] === 'string') {
                                if (Helpers.isObject(MP.integrationAttributes[integrationId])) {
                                    MP.integrationAttributes[integrationId][key] = attrs[key];
                                } else {
                                    MP.integrationAttributes[integrationId] = {};
                                    MP.integrationAttributes[integrationId][key] = attrs[key];
                                }
                            } else {
                                Helpers.logDebug('Values for integration attributes must be strings. You entered a ' + typeof attrs[key]);
                                continue;
                            }
                        } else {
                            Helpers.logDebug('Keys must be strings, you entered a ' + typeof key);
                            continue;
                        }
                    }
                }
            } else {
                Helpers.logDebug('Attrs must be an object with keys and values. You entered a ' + typeof attrs);
                return;
            }
            Persistence.update();
        },
        /**
        * Get integration attributes for a given integration ID.
        * @method getIntegrationAttributes
        * @param {Number} integrationId mParticle integration ID
        * @return {Object} an object map of the integrationId's attributes
        */
        getIntegrationAttributes: function(integrationId) {
            if (MP.integrationAttributes[integrationId]) {
                return MP.integrationAttributes[integrationId];
            } else {
                return {};
            }
        },
        addForwarder: function(forwarderProcessor) {
            MP.forwarderConstructors.push(forwarderProcessor);
        },
        configureForwarder: function(configuration) {
            var newForwarder = null,
                config = configuration;
            for (var i = 0; i < MP.forwarderConstructors.length; i++) {
                if (MP.forwarderConstructors[i].name === config.name) {
                    if (config.isDebug === mParticle.isDevelopmentMode || config.isSandbox === mParticle.isDevelopmentMode) {
                        newForwarder = new MP.forwarderConstructors[i].constructor();

                        newForwarder.id = config.moduleId;
                        newForwarder.isSandbox = config.isDebug || config.isSandbox;
                        newForwarder.hasSandbox = config.hasDebugString === 'true';
                        newForwarder.isVisible = config.isVisible;
                        newForwarder.settings = config.settings;

                        newForwarder.eventNameFilters = config.eventNameFilters;
                        newForwarder.eventTypeFilters = config.eventTypeFilters;
                        newForwarder.attributeFilters = config.attributeFilters;

                        newForwarder.screenNameFilters = config.screenNameFilters;
                        newForwarder.screenNameFilters = config.screenNameFilters;
                        newForwarder.pageViewAttributeFilters = config.pageViewAttributeFilters;

                        newForwarder.userIdentityFilters = config.userIdentityFilters;
                        newForwarder.userAttributeFilters = config.userAttributeFilters;

                        newForwarder.filteringEventAttributeValue = config.filteringEventAttributeValue;
                        newForwarder.filteringUserAttributeValue = config.filteringUserAttributeValue;
                        newForwarder.eventSubscriptionId = config.eventSubscriptionId;
                        newForwarder.filteringConsentRuleValues = config.filteringConsentRuleValues;
                        newForwarder.excludeAnonymousUser = config.excludeAnonymousUser;

                        MP.configuredForwarders.push(newForwarder);
                        break;
                    }
                }
            }
        },
        configurePixel: function(settings) {
            if (settings.isDebug === mParticle.isDevelopmentMode || settings.isProduction !== mParticle.isDevelopmentMode) {
                MP.pixelConfigurations.push(settings);
            }
        },
        _getActiveForwarders: function() {
            return MP.activeForwarders;
        },
        _getIntegrationDelays: function() {
            return MP.integrationDelays;
        },
        _configureFeatures: function(featureFlags) {
            for (var key in featureFlags) {
                if (featureFlags.hasOwnProperty(key)) {
                    MP.featureFlags[key] = featureFlags[key];
                }
            }
        },
        _setIntegrationDelay: function(module, boolean) {
            MP.integrationDelays[module] = boolean;
        }
    };

    function processPreloadedItem(readyQueueItem) {
        var currentUser,
            args = readyQueueItem,
            method = args.splice(0, 1)[0];
        if (mParticle[args[0]]) {
            mParticle[method].apply(this, args);
        } else {
            var methodArray = method.split('.');
            try {
                var computedMPFunction = mParticle;
                for (var i = 0; i < methodArray.length; i++) {
                    var currentMethod = methodArray[i];
                    computedMPFunction = computedMPFunction[currentMethod];
                }
                computedMPFunction.apply(currentUser, args);
            } catch(e) {
                Helpers.logDebug('Unable to compute proper mParticle function ' + e);
            }
        }
    }

    // Read existing configuration if present
    if (window.mParticle && window.mParticle.config) {
        if (window.mParticle.config.serviceUrl) {
            Constants.serviceUrl = window.mParticle.config.serviceUrl;
        }

        if (window.mParticle.config.secureServiceUrl) {
            Constants.secureServiceUrl = window.mParticle.config.secureServiceUrl;
        }

        // Check for any functions queued
        if (window.mParticle.config.rq) {
            MP.readyQueue = window.mParticle.config.rq;
        }

        if (window.mParticle.config.logLevel) {
            MP.logLevel = window.mParticle.config.logLevel;
        }

        if (window.mParticle.config.hasOwnProperty('isDevelopmentMode')) {
            mParticle.isDevelopmentMode = Helpers.returnConvertedBoolean(window.mParticle.config.isDevelopmentMode);
        }

        if (window.mParticle.config.hasOwnProperty('useNativeSdk')) {
            mParticle.useNativeSdk = window.mParticle.config.useNativeSdk;
        }

        if (window.mParticle.config.hasOwnProperty('useCookieStorage')) {
            mParticle.useCookieStorage = window.mParticle.config.useCookieStorage;
        }

        if (window.mParticle.config.hasOwnProperty('maxProducts')) {
            mParticle.maxProducts = window.mParticle.config.maxProducts;
        }

        if (window.mParticle.config.hasOwnProperty('maxCookieSize')) {
            mParticle.maxCookieSize = window.mParticle.config.maxCookieSize;
        }

        if (window.mParticle.config.hasOwnProperty('appName')) {
            MP.appName = window.mParticle.config.appName;
        }

        if (window.mParticle.config.hasOwnProperty('integrationDelayTimeout')) {
            mParticle.integrationDelayTimeout = window.mParticle.config.integrationDelayTimeout;
        }

        if (window.mParticle.config.hasOwnProperty('identifyRequest')) {
            mParticle.identifyRequest = window.mParticle.config.identifyRequest;
        }

        if (window.mParticle.config.hasOwnProperty('identityCallback')) {
            var callback = window.mParticle.config.identityCallback;
            if (Validators.isFunction(callback)) {
                mParticle.identityCallback = window.mParticle.config.identityCallback;
            } else {
                Helpers.logDebug('The optional callback must be a function. You tried entering a(n) ' + typeof callback, ' . Callback not set. Please set your callback again.');
            }
        }

        if (window.mParticle.config.hasOwnProperty('appVersion')) {
            MP.appVersion = window.mParticle.config.appVersion;
        }

        if (window.mParticle.config.hasOwnProperty('sessionTimeout')) {
            MP.Config.SessionTimeout = window.mParticle.config.sessionTimeout;
        }

        if (window.mParticle.config.hasOwnProperty('forceHttps')) {
            mParticle.forceHttps = window.mParticle.config.forceHttps;
        } else {
            mParticle.forceHttps = true;
        }

        // Some forwarders require custom flags on initialization, so allow them to be set using config object
        if (window.mParticle.config.hasOwnProperty('customFlags')) {
            MP.customFlags = window.mParticle.config.customFlags;
        }

        if (window.mParticle.config.hasOwnProperty('workspaceToken')) {
            mParticle.workspaceToken = window.mParticle.config.workspaceToken;
        }

        if (window.mParticle.config.hasOwnProperty('requiredWebviewBridgeName')) {
            mParticle.requiredWebviewBridgeName = window.mParticle.config.requiredWebviewBridgeName;
        } else {
            mParticle.requiredWebviewBridgeName = window.mParticle.config.workspaceToken;
        }

        if (window.mParticle.config.hasOwnProperty('minWebviewBridgeVersion')) {
            mParticle.minWebviewBridgeVersion = window.mParticle.config.minWebviewBridgeVersion;
        }
    }

    window.mParticle = mParticle;
})(window);
