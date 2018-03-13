/* eslint-disable quotes*/
var TestsCore = require('./tests-core'),
    Persistence = require('../../src/persistence'),
    apiKey = TestsCore.apiKey,
    testMPID = TestsCore.testMPID,
    findCookie = TestsCore.findCookie,
    v1CookieKey = TestsCore.v1CookieKey,
    v1localStorageKey = TestsCore.v1localStorageKey,
    getLocalStorage = TestsCore.getLocalStorage,
    getLocalStorageProducts = TestsCore.getLocalStorageProducts,
    setCookie = TestsCore.setCookie,
    setLocalStorage = TestsCore.setLocalStorage,
    server = TestsCore.server,
    v4CookieKey = 'mprtcl-v4',
    v4LSKey = 'mprtcl-v4';

describe('migrations and persistence-related', function() {
    it('should filter out any non string or number ids', function(done) {
        mParticle.reset();
        var lsData = {
            ui: [{Identity: 123, Type: 1}, {Identity: '123', Type: 2}, {Identity: [], Type: 1}, {Identity: {}, Type: 1}],
            mpid: testMPID
        };

        setLocalStorage(v1localStorageKey, lsData);

        mParticle.init(apiKey);

        var localStorageData = mParticle.persistence.getLocalStorage(v4LSKey);
        Object.keys(localStorageData[lsData.mpid].ui).length.should.equal(2);

        done();
    });

    it('should filter out any multiple UIs with no IDs', function(done) {
        mParticle.reset();

        setLocalStorage(v1localStorageKey, {
            ui: [{Identity: 123, Type: 1}, {Type: 1}, {Type: 1}, {Type: 1}],
            mpid: testMPID
        });

        mParticle.init(apiKey);

        var localStorageData = mParticle.persistence.getLocalStorage(v4LSKey);

        Object.keys(localStorageData[testMPID].ui).length.should.equal(1);

        done();
    });

    it('should migrate previous user identity schema (array) to current schema (object)', function(done) {
        mParticle.reset();
        var userIdentities = [{Type: 1, Identity: 'id1'}, {Type: 7, Identity: 'email@domain.com'}];
        setLocalStorage(v1localStorageKey, {ui: userIdentities, mpid: testMPID});
        mParticle.init(apiKey);

        var localStorageData = getLocalStorage();

        localStorageData.testMPID.should.have.property('ui');
        localStorageData.testMPID.ui.should.have.property('1', 'id1');

        done();
    });

    it('should move new schema from cookies to localStorage with useCookieStorage = false', function(done) {
        mParticle.reset();
        setCookie(v1CookieKey, {
            ui: [{Identity: 'customerId1', Type: 1}],
            mpid: testMPID,
            ie: true
        });
        var beforeInitCookieData = findCookie(v1CookieKey);

        mParticle.useCookieStorage = false;
        mParticle.init(apiKey);
        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'male');
        var localStorageData = mParticle.persistence.getLocalStorage();
        var afterInitCookieData = findCookie(v4CookieKey);

        beforeInitCookieData.ui[0].should.have.property('Identity', 'customerId1');
        localStorageData[testMPID].ua.should.have.property('gender', 'male');
        localStorageData[testMPID].ui.should.have.property('1', 'customerId1');
        Should(afterInitCookieData).not.be.ok();

        done();
    });

    it('should move old schema from localStorage to cookies with useCookieStorage = true', function(done) {
        mParticle.reset();
        setLocalStorage(v1localStorageKey, {
            ui: [{Identity: 123, Type: 1}],
            mpid: testMPID,
            ie: true
        });

        mParticle.useCookieStorage = true;

        mParticle.init(apiKey);

        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'male');
        var localStorageData = localStorage.getItem('mprtcl-api');
        var cookieData = findCookie(v4CookieKey);
        Should(localStorageData).not.be.ok();

        cookieData[testMPID].ua.should.have.property('gender', 'male');
        cookieData[testMPID].ui.should.have.property('1', 123);

        window.mParticle.useCookieStorage = false;

        done();
    });

    it('should move new schema from localStorage to cookies with useCookieStorage = true', function(done) {
        mParticle.reset();
        setLocalStorage(v1localStorageKey, {
            ui: [{Identity: '123', Type: 1}],
            mpid: testMPID,
            ie: true
        });

        mParticle.useCookieStorage = true;
        mParticle.init(apiKey);

        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'male');

        var localStorageData = localStorage.getItem('mprtcl-api');
        var cookieData = findCookie();

        Should(localStorageData).not.be.ok();
        cookieData[testMPID].ua.should.have.property('gender', 'male');
        cookieData[testMPID].ui.should.have.property('1', '123');

        window.mParticle.useCookieStorage = false;

        done();
    });

    it('should move old schema from cookies to localStorage with useCookieStorage = false', function(done) {
        mParticle.reset();
        setCookie(v1CookieKey, {
            ui: [{Identity: '123', Type: 1}],
            mpid: testMPID,
            ie: true
        });
        var beforeInitCookieData = findCookie(v1CookieKey);

        mParticle.useCookieStorage = false;
        mParticle.init(apiKey);

        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'male');

        var localStorageData = mParticle.persistence.getLocalStorage();
        var afterInitCookieData = mParticle.persistence.getCookie();
        beforeInitCookieData.ui[0].should.have.property('Identity', '123');
        localStorageData[testMPID].ua.should.have.property('gender', 'male');
        localStorageData[testMPID].ui.should.have.property('1', '123');
        Should(afterInitCookieData).not.be.ok();

        done();
    });

    it('localStorage - should key cookies on mpid on first run', function(done) {
        var cookies1 = mParticle.persistence.getLocalStorage();
        var props1 = ['ie', 'sa', 'ua', 'ui', 'ss', 'dt', 'les', 'av', 'cgid', 'das', 'csd', 'mpid', 'cp', 'sid', 'c'];
        props1.forEach(function(prop) {
            cookies1.should.not.have.property(prop);
        });
        cookies1.should.have.property('cu', testMPID, 'gs');
        cookies1.should.have.property(testMPID);

        var props2 = ['ie', 'sa', 'ss', 'dt', 'les', 'av', 'cgid', 'das', 'sid', 'c', 'mpid', 'cp'];

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                mpid: 'otherMPID'
            }));
        };

        mParticle.Identity.login();

        var cookies2 = mParticle.persistence.getLocalStorage();

        cookies2.should.have.property('cu', 'otherMPID', 'gs');
        props2.forEach(function(prop) {
            cookies1[testMPID].should.not.have.property(prop);
            cookies2[testMPID].should.not.have.property(prop);
            cookies2['otherMPID'].should.not.have.property(prop);
        });

        done();
    });

    it('cookies - should key cookies on mpid when there are no cookies yet', function(done) {
        mParticle.reset();
        window.mParticle.useCookieStorage = true;
        mParticle.init(apiKey);

        var cookies1 = findCookie();

        var props1 = ['ie', 'sa', 'ua', 'ui', 'ss', 'dt', 'les', 'av', 'cgid', 'das', 'csd', 'mpid', 'cp', 'sid', 'c'];
        cookies1.should.have.property('cu', testMPID, 'gs');
        props1.forEach(function(prop) {
            cookies1.should.not.have.property(prop);
        });

        var props2 = ['ie', 'sa', 'ss', 'dt', 'les', 'av', 'cgid', 'das', 'sid', 'c', 'mpid', 'cp'];

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                mpid: 'otherMPID'
            }));
        };

        mParticle.Identity.login();
        var cookies2 = findCookie();

        cookies2.should.have.property('cu', 'otherMPID', testMPID);

        props2.forEach(function(prop) {
            cookies1[testMPID].should.not.have.property(prop);
            cookies2[testMPID].should.not.have.property(prop);
            cookies2['otherMPID'].should.not.have.property(prop);
        });

        done();
    });

    it('localStorage - should migrate previous cookies into JS SDK v2 schema', function(done) {
        mParticle.reset();
        window.mParticle.useCookieStorage = false;

        var lsData = {
            mpid: testMPID,
            cgid: 'cgidTEST',
            ui: [{Identity: 123, Type: 1}],
            ua: {foo: 'bar'},
            cp: [{product: 'test'}],
            pb: {bag1: [{product: 'item1'}]},
            csd: { 5: 'test'}
        };

        setLocalStorage(v1localStorageKey, lsData);

        mParticle.init(apiKey);
        var cookiesAfterInit = mParticle.persistence.getLocalStorage();

        cookiesAfterInit.should.not.have.property('cgid');
        cookiesAfterInit.should.not.have.property('mpid');
        cookiesAfterInit.should.have.properties([testMPID, 'cu', 'gs']);
        cookiesAfterInit.gs.should.have.property('cgid', 'cgidTEST');
        cookiesAfterInit[testMPID].should.have.properties(['ua', 'ui', 'csd']);

        var props = ['ie', 'sa', 'ss', 'dt', 'les', 'av', 'cgid', 'das', 'sid', 'c', 'mpid', 'cp'];

        props.forEach(function(prop) {
            cookiesAfterInit[testMPID].should.not.have.property(prop);
        });

        cookiesAfterInit[testMPID].ua.should.have.property('foo', 'bar');
        cookiesAfterInit[testMPID].ui.should.have.property('1', 123);
        cookiesAfterInit[testMPID].csd.should.have.property(5, 'test');

        var products = getLocalStorageProducts();
        products.testMPID.cp[0].product.should.equal(lsData.cp[0].product);

        done();
    });

    it('cookies - should migrate previous cookies into JS SDK v2 schema', function(done) {
        mParticle.reset();
        window.mParticle.useCookieStorage = true;

        setLocalStorage(v1localStorageKey, {
            mpid: testMPID,
            cgid: 'cgidTEST',
            ui: [{
                Identity: 'objData',
                Type: 1
            }]
        });

        mParticle.init(apiKey);

        var cookiesAfterInit = findCookie();
        cookiesAfterInit.should.not.have.property('cgid');
        cookiesAfterInit.should.not.have.property('mpid');
        cookiesAfterInit.should.have.properties([testMPID, 'cu', 'gs']);
        cookiesAfterInit.gs.should.have.property('cgid', 'cgidTEST');
        cookiesAfterInit[testMPID].ui.should.have.property('1', 'objData');

        var props = ['ie', 'sa', 'ss', 'dt', 'les', 'av', 'cgid', 'das', 'sid', 'c', 'mpid', 'cp'];

        props.forEach(function(prop) {
            cookiesAfterInit[testMPID].should.not.have.property(prop);
        });

        done();
    });

    it('puts data into cookies when running initializeStorage with useCookieStorage = true', function(done) {
        window.mParticle.useCookieStorage = true;

        mParticle.persistence.initializeStorage();

        var cookieData = findCookie();

        var localStorageData = mParticle.persistence.getLocalStorage();

        cookieData.should.have.properties(['gs', 'cu', testMPID]);

        var props = ['ie', 'sa', 'ss', 'dt', 'les', 'av', 'cgid', 'das', 'sid', 'c', 'mpid', 'cp'];

        props.forEach(function(prop) {
            cookieData[testMPID].should.not.have.property(prop);
        });

        Should(localStorageData).not.be.ok();


        done();
    });

    it('puts data into localStorage when running initializeStorage with useCookieStorage = false', function(done) {
        window.mParticle.useCookieStorage = false;
        mParticle.persistence.initializeStorage();

        var cookieData = mParticle.persistence.getCookie();

        var localStorageData = mParticle.persistence.getLocalStorage();

        localStorageData.should.have.properties(['gs', 'cu', testMPID]);

        var props = ['ie', 'sa', 'ss', 'dt', 'les', 'av', 'cgid', 'das', 'sid', 'c', 'mpid', 'cp'];

        props.forEach(function(prop) {
            localStorageData[testMPID].should.not.have.property(prop);
        });

        Should(cookieData).not.be.ok();

        done();
    });

    it('puts data into cookies when updating persistence with useCookieStorage = true', function(done) {
        var cookieData, localStorageData;

        window.mParticle.useCookieStorage = true;
        mParticle.persistence.initializeStorage();

        cookieData = findCookie();
        cookieData.should.have.properties(['gs', 'cu', testMPID]);
        localStorageData = mParticle.persistence.getLocalStorage();

        var props = ['ie', 'sa', 'ss', 'dt', 'les', 'av', 'cgid', 'das', 'sid', 'c', 'mpid', 'cp'];
        props.forEach(function(prop) {
            cookieData[testMPID].should.not.have.property(prop);
        });

        Should(localStorageData).not.be.ok();

        window.mParticle.useCookieStorage = false;

        done();
    });

    it('puts data into localStorage when updating persistence with useCookieStorage = false', function(done) {
        var localStorageData, cookieData;
        // Flush out anything in expire before updating in order to silo testing persistence.update()
        window.mParticle.useCookieStorage = false;
        mParticle.persistence.update();

        localStorageData = getLocalStorage();
        cookieData = findCookie();

        localStorageData.should.have.properties(['gs', 'cu', testMPID]);

        var props = ['ie', 'sa', 'ss', 'dt', 'les', 'av', 'cgid', 'das', 'sid', 'c', 'mpid', 'cp'];
        props.forEach(function(prop) {
            localStorageData[testMPID].should.not.have.property(prop);
        });

        Should(cookieData).not.be.ok();

        done();
    });

    it('should revert to cookie storage if localStorage is not available and useCookieStorage is set to false', function(done) {
        mParticle.reset();
        mParticle.persistence.determineLocalStorageAvailability = function() {
            return false;
        };

        mParticle.useCookieStorage = false;

        mParticle.init(apiKey);

        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'male');

        var cookieData = findCookie();
        cookieData[testMPID].ua.should.have.property('gender', 'male');

        mParticle.persistence.determineLocalStorageAvailability = function() { return true; };

        done();
    });

    it('stores data in memory both when the result is passed in as a string or as an object', function(done) {
        var objData = {
            testMPID: {ui: {1: 'objData'}}
        };
        mParticle.persistence.storeDataInMemory(objData, testMPID);

        var userIdentity1 = mParticle.Identity.getCurrentUser().getUserIdentities();

        userIdentity1.userIdentities.should.have.property('customerid', 'objData');

        done();
    });

    it('should set certain attributes onto global localStorage, while setting user specific to the MPID', function(done) {
        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'male');

        var data = getLocalStorage();

        data.cu.should.equal(testMPID);
        data.gs.should.have.properties(['sid', 'ie', 'dt', 'cgid', 'das', 'les']);
        data.testMPID.ua.should.have.property('gender', 'male');

        done();
    });

    it('should set certain attributes onto global cookies, while setting user specific to the MPID', function(done) {
        mParticle.useCookieStorage = true;
        mParticle.init(apiKey);
        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'male');

        var data = findCookie();
        data.cu.should.equal(testMPID);

        data.gs.should.have.properties(['sid', 'ie', 'dt', 'cgid', 'das', 'les']);
        data.testMPID.ua.should.have.property('gender', 'male');

        done();
    });

    it('should add new MPID to cookies when returned MPID does not match anything in cookies, and have empty UI and UA', function(done) {
        mParticle.reset();

        mParticle.init(apiKey);
        var user1 = { userIdentities: { customerid: 'customerid1' } };

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                Store: {},
                mpid: 'mpid1'
            }));
        };

        mParticle.Identity.login(user1);
        var user1Result = mParticle.Identity.getCurrentUser().getUserIdentities();
        user1Result.userIdentities.customerid.should.equal('customerid1');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                Store: {},
                mpid: 'mpid2'
            }));
        };

        mParticle.Identity.logout();

        var user2Result = mParticle.Identity.getCurrentUser();
        Object.keys(user2Result.getUserIdentities().userIdentities).length.should.equal(0);

        var localStorageData = mParticle.persistence.getLocalStorage();

        localStorageData.cu.should.equal('mpid2');
        localStorageData.testMPID.should.not.have.property('ui');
        localStorageData.mpid1.ui[1].should.equal('customerid1');
        localStorageData.mpid2.should.not.have.property('ui');

        done();
    });

    it('should have the same currentUserMPID as the last browser session when a reload occurs and no identityRequest is provided', function(done) {
        mParticle.reset();
        var user1 = {
            userIdentities: {
                customerid: '1'
            }
        };

        var user2 = {
            userIdentities: {
                customerid: '2'
            }
        };

        var user3 = {
            userIdentities: {
                customerid: '3'
            }
        };

        mParticle.init(apiKey);

        var data = mParticle.persistence.getLocalStorage();
        data.cu.should.equal(testMPID);

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                Store: {},
                mpid: 'mpid1'
            }));
        };

        mParticle.Identity.login(user1);
        var user1Data = mParticle.persistence.getLocalStorage();

        user1Data.cu.should.equal('mpid1');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                Store: {},
                mpid: 'mpid2'
            }));
        };

        mParticle.Identity.login(user2);
        var user2Data = mParticle.persistence.getLocalStorage();

        user2Data.cu.should.equal('mpid2');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                Store: {},
                mpid: 'mpid3'
            }));
        };

        mParticle.Identity.login(user3);
        var user3data = mParticle.persistence.getLocalStorage();
        user3data.cu.should.equal('mpid3');

        mParticle.init();

        var data3 = mParticle.persistence.getLocalStorage();
        data3.cu.should.equal('mpid3');

        done();
    });

    it('should transfer user attributes and revert to user identities properly', function(done) {
        mParticle.reset();
        var user1 = { userIdentities: { customerid: 'customerid1'}};

        var user2 = { userIdentities: { customerid: 'customerid2'}};

        mParticle.init(apiKey);

        mParticle.Identity.getCurrentUser().setUserAttribute('test1', 'test1');

        var data = getLocalStorage();

        data.cu.should.equal(testMPID);
        data.testMPID.ua.should.have.property('test1', 'test1');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                Store: {},
                mpid: 'mpid1'
            }));
        };

        mParticle.Identity.login(user1);

        mParticle.Identity.modify({userIdentities: {email: 'email@test.com'}});

        mParticle.Identity.getCurrentUser().setUserAttribute('test2', 'test2');
        var user1Data = mParticle.persistence.getLocalStorage();
        user1Data.cu.should.equal('mpid1');
        user1Data.mpid1.ua.should.have.property('test2', 'test2');
        user1Data.mpid1.ui.should.have.property('7', 'email@test.com');
        user1Data.mpid1.ui.should.have.property('1', 'customerid1');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                Store: {},
                mpid: 'mpid2'
            }));
        };

        mParticle.Identity.login(user2);
        mParticle.Identity.getCurrentUser().setUserAttribute('test3', 'test3');
        var user2Data = mParticle.persistence.getLocalStorage();

        user2Data.cu.should.equal('mpid2');
        user2Data.mpid2.ui.should.have.property('1', 'customerid2');
        user2Data.mpid2.ua.should.have.property('test3', 'test3');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                Store: {},
                mpid: 'mpid1'
            }));
        };

        mParticle.Identity.login(user1);
        var user1RelogInData = mParticle.persistence.getLocalStorage();

        user1RelogInData.cu.should.equal('mpid1');
        user1RelogInData.mpid1.ui.should.have.property('1', 'customerid1');
        user1RelogInData.mpid1.ui.should.have.property('7', 'email@test.com');

        Object.keys(user1RelogInData.mpid1.ui).length.should.equal(2);
        user1RelogInData.mpid1.ua.should.have.property('test2', 'test2');

        done();
    });

    it('should replace commas with pipes, and pipes with commas', function(done) {
        var pipes = '{"cgid":"abc"|"das":"def"|"dt":"hij"|"ie":true|"les":1505932333024|"sid":"klm"}';
        var commas = '{"cgid":"abc","das":"def","dt":"hij","ie":true,"les":1505932333024,"sid":"klm"}';

        mParticle.persistence.replaceCommasWithPipes(commas).should.equal(pipes);
        mParticle.persistence.replacePipesWithCommas(pipes).should.equal(commas);

        done();
    });

    it('should replace apostrophes with quotes and quotes with apostrophes', function(done) {
        var quotes = '{"cgid":"abc"|"das":"def"|"dt":"hij"|"ie":true|"les":1505932333024|"sid":"klm"}';
        var apostrophes = "{'cgid':'abc'|'das':'def'|'dt':'hij'|'ie':true|'les':1505932333024|'sid':'klm'}";

        mParticle.persistence.replaceQuotesWithApostrophes(quotes).should.equal(apostrophes);
        mParticle.persistence.replaceApostrophesWithQuotes(apostrophes).should.equal(quotes);

        done();
    });

    it('should create valid cookie string and revert cookie string', function(done) {
        var before = '{"cgid":"abc","das":"def","dt":"hij","ie":true,"les":1505932333024,"sid":"klm"}';
        var after = "{'cgid':'abc'|'das':'def'|'dt':'hij'|'ie':true|'les':1505932333024|'sid':'klm'}";

        mParticle.persistence.createCookieString(before).should.equal(after);
        mParticle.persistence.revertCookieString(after).should.equal(before);

        done();
    });

    it('should remove MPID as keys if the cookie size is beyond the setting', function(done) {
        mParticle.isDevelopmentMode = true;
        mParticle.reset();
        mParticle.maxCookieSize = 700;

        var cookies = {
            gs: {
                csm: ['mpid1', 'mpid2', 'mpid3'],
                sid: 'abcd',
                ie: true,
                dt: apiKey,
                cgid: 'cgid1',
                das: 'das1'
            },
            cu: 'mpid3',
            mpid1: {
                ua: {gender: 'female', age: 29, height: '65', color: 'blue', id: 'abcdefghijklmnopqrstuvwxyz'},
                ui: {1: 'customerid123', 2: 'facebookid123'}
            },
            mpid2: {
                ua: {gender: 'male', age: 20, height: '68', color: 'red'},
                ui: {1: 'customerid234', 2: 'facebookid234', id: 'abcdefghijklmnopqrstuvwxyz'}
            },
            mpid3: {
                ua: {gender: 'male', age: 20, height: '68', color: 'red'},
                ui: {1: 'customerid234', 2: 'facebookid234', id: 'abcdefghijklmnopqrstuvwxyz'}
            }
        };
        var expires = new Date((new Date).getTime() + (365 * 24 * 60 * 60 * 1000)).toGMTString();
        var cookiesWithExpiration = Persistence.reduceAndEncodeCookies(cookies, expires, 'testDomain');
        var cookiesWithoutExpiration = cookiesWithExpiration.slice(0, cookiesWithExpiration.indexOf(';expires'));
        var cookiesResult = JSON.parse(Persistence.decodeCookies(cookiesWithoutExpiration));
        Should(cookiesResult['mpid1']).not.be.ok();
        Should(cookiesResult['mpid2']).be.ok();
        Should(cookiesResult['mpid3']).be.ok();
        cookiesResult.gs.csm.length.should.equal(3);
        cookiesResult.gs.csm[0].should.equal('mpid1');
        cookiesResult.gs.csm[1].should.equal('mpid2');
        cookiesResult.gs.csm[2].should.equal('mpid3');

        done();
    });

    it('integration test - will change the order of the CSM when a previous MPID logs in again', function(done) {
        mParticle.reset();
        mParticle.useCookieStorage = true;
        mParticle.maxCookieSize = 1000;
        mParticle.init(apiKey);

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                mpid: 'MPID1'
            }));
        };

        mParticle.Identity.login();

        var cookieData = findCookie();
        cookieData.gs.csm[0].should.be.equal('testMPID');
        cookieData.gs.csm[1].should.be.equal('MPID1');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                mpid: 'MPID2'
            }));
        };

        mParticle.Identity.login();

        cookieData = findCookie();
        cookieData.gs.csm[0].should.be.equal('testMPID');
        cookieData.gs.csm[1].should.be.equal('MPID1');
        cookieData.gs.csm[2].should.be.equal('MPID2');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                mpid: 'testMPID'
            }));
        };

        mParticle.Identity.login();

        cookieData = findCookie();
        cookieData.gs.csm[0].should.be.equal('MPID1');
        cookieData.gs.csm[1].should.be.equal('MPID2');
        cookieData.gs.csm[2].should.be.equal('testMPID');

        done();
    });

    it('integration test - should remove a previous MPID as a key from cookies if new user attribute added and exceeds the size of the max cookie size', function(done) {
        mParticle.reset();
        mParticle.useCookieStorage = true;
        mParticle.maxCookieSize = 600;

        mParticle.init(apiKey);

        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'female');
        mParticle.Identity.getCurrentUser().setUserAttribute('age', 30);
        mParticle.Identity.getCurrentUser().setUserAttribute('height', '68');
        mParticle.Identity.getCurrentUser().setUserAttribute('color', 'blue');
        mParticle.Identity.getCurrentUser().setUserAttribute('id', 'id1');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                mpid: 'MPID1'
            }));
        };

        mParticle.Identity.login();

        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'male');
        mParticle.Identity.getCurrentUser().setUserAttribute('age', 30);
        mParticle.Identity.getCurrentUser().setUserAttribute('height', '60');
        mParticle.Identity.getCurrentUser().setUserAttribute('color', 'green');
        mParticle.Identity.getCurrentUser().setUserAttribute('id', 'id2');

        var cookieData = findCookie();
        cookieData.gs.csm[0].should.equal('testMPID');
        cookieData.gs.csm[1].should.equal('MPID1');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                mpid: 'MPID2'
            }));
        };
        mParticle.Identity.login();

        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'female');
        mParticle.Identity.getCurrentUser().setUserAttribute('age', 45);
        mParticle.Identity.getCurrentUser().setUserAttribute('height', '80');
        mParticle.Identity.getCurrentUser().setUserAttribute('color', 'green');

        //this last one puts us over the maxcookiesize threshold and removes 'testMPID' from cookie
        mParticle.Identity.getCurrentUser().setUserAttribute('id', 'id3');

        cookieData = findCookie();

        Should(cookieData['testMPID']).not.be.ok();
        cookieData['MPID1'].ua.should.have.property('id', 'id2');
        cookieData['MPID1'].ua.should.have.property('gender', 'male');
        cookieData['MPID1'].ua.should.have.property('age', 30);
        cookieData['MPID1'].ua.should.have.property('height', '60');
        cookieData['MPID1'].ua.should.have.property('color', 'green');
        cookieData['MPID2'].ua.should.have.property('id', 'id3');
        cookieData['MPID2'].ua.should.have.property('gender', 'female');
        cookieData['MPID2'].ua.should.have.property('age', 45);
        cookieData['MPID2'].ua.should.have.property('height', '80');
        cookieData['MPID2'].ua.should.have.property('color', 'green');

        done();
    });

    it('should remove a random MPID from storage if there is a new session and there are no other MPIDs in currentSessionMPIDs except for the currentUser mpid', function(done) {
        mParticle.isDevelopmentMode = true;
        mParticle.reset();
        mParticle.useCookieStorage = true;
        mParticle.maxCookieSize = 400;

        var cookies = {
            gs: {
                csm: ['mpid3'],
                sid: 'abcd',
                ie: true,
                dt: apiKey,
                cgid: 'cgid1',
                das: 'das1'
            },
            cu: 'mpid3',
            mpid1: {
                ua: {gender: 'female', age: 29, height: '65', color: 'blue', id: 'abcdefghijklmnopqrstuvwxyz'},
                ui: {1: 'customerid123', 2: 'facebookid123'}
            },
            mpid2: {
                ua: {gender: 'male', age: 20, height: '68', color: 'red'},
                ui: {1: 'customerid234', 2: 'facebookid234', id: 'abcdefghijklmnopqrstuvwxyz'}
            },
            mpid3: {
                ua: {gender: 'male', age: 20, height: '68', color: 'red'},
                ui: {1: 'customerid234', 2: 'facebookid234', id: 'abcdefghijklmnopqrstuvwxyz'}
            }
        };

        var expires = new Date((new Date).getTime() + (365 * 24 * 60 * 60 * 1000)).toGMTString();

        var cookiesWithExpiration = Persistence.reduceAndEncodeCookies(cookies, expires, 'testDomain');
        var cookiesWithoutExpiration = cookiesWithExpiration.slice(0, cookiesWithExpiration.indexOf(';expires'));
        var cookiesResult = JSON.parse(Persistence.decodeCookies(cookiesWithoutExpiration));

        Should(cookiesResult['mpid1']).not.be.ok();
        Should(cookiesResult['mpid2']).not.be.ok();
        Should(cookiesResult['mpid3']).be.ok();
        cookiesResult.gs.csm[0].should.equal('mpid3');
        cookiesResult.should.have.property('mpid3');
        mParticle.maxCookieSize = 3000;

        done();
    });

    it('integration test - should remove a random MPID from storage if there is a new session and there are no MPIDs in currentSessionMPIDs', function(done) {
        mParticle.reset();
        mParticle.useCookieStorage = true;
        mParticle.maxCookieSize = 600;
        mParticle.isDevelopmentMode = true;

        mParticle.init(apiKey);

        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'female');
        mParticle.Identity.getCurrentUser().setUserAttribute('age', 30);
        mParticle.Identity.getCurrentUser().setUserAttribute('height', '68');
        mParticle.Identity.getCurrentUser().setUserAttribute('color', 'blue');
        mParticle.Identity.getCurrentUser().setUserAttribute('id', 'id1');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                mpid: 'MPID1'
            }));
        };

        mParticle.Identity.login();

        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'male');
        mParticle.Identity.getCurrentUser().setUserAttribute('age', 30);
        mParticle.Identity.getCurrentUser().setUserAttribute('height', '60');
        mParticle.Identity.getCurrentUser().setUserAttribute('color', 'green');
        mParticle.Identity.getCurrentUser().setUserAttribute('id', 'id2');

        var cookieData = findCookie();

        cookieData.gs.csm[0].should.equal('testMPID');
        cookieData.gs.csm[1].should.equal('MPID1');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                mpid: 'MPID2'
            }));
        };

        mParticle.endSession();
        mParticle.Identity.login();

        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'female');
        mParticle.Identity.getCurrentUser().setUserAttribute('age', 45);
        mParticle.Identity.getCurrentUser().setUserAttribute('height', '80');
        mParticle.Identity.getCurrentUser().setUserAttribute('color', 'green');
        mParticle.Identity.getCurrentUser().setUserAttribute('id', 'id3');

        cookieData = findCookie();

        Should(cookieData['testMPID']).not.be.ok();
        cookieData['MPID1'].ua.should.have.property('id', 'id2');
        cookieData['MPID1'].ua.should.have.property('gender', 'male');
        cookieData['MPID1'].ua.should.have.property('age', 30);
        cookieData['MPID1'].ua.should.have.property('height', '60');
        cookieData['MPID1'].ua.should.have.property('color', 'green');
        cookieData['MPID2'].ua.should.have.property('id', 'id3');
        cookieData['MPID2'].ua.should.have.property('gender', 'female');
        cookieData['MPID2'].ua.should.have.property('age', 45);
        cookieData['MPID2'].ua.should.have.property('height', '80');
        cookieData['MPID2'].ua.should.have.property('color', 'green');

        done();
    });

    it('integration test - migrates a large localStorage cookie to cookies and properly remove MPIDs', function(done) {
        mParticle.reset();
        mParticle.useCookieStorage = false;
        mParticle.maxCookieSize = 600;
        mParticle.isDevelopmentMode = true;

        mParticle.init(apiKey);
        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'female');
        mParticle.Identity.getCurrentUser().setUserAttribute('age', 30);
        mParticle.Identity.getCurrentUser().setUserAttribute('height', '68');
        mParticle.Identity.getCurrentUser().setUserAttribute('color', 'blue');
        mParticle.Identity.getCurrentUser().setUserAttribute('id', 'id1');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                mpid: 'MPID1'
            }));
        };

        mParticle.Identity.login();

        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'male');
        mParticle.Identity.getCurrentUser().setUserAttribute('age', 30);
        mParticle.Identity.getCurrentUser().setUserAttribute('height', '60');
        mParticle.Identity.getCurrentUser().setUserAttribute('color', 'green');
        mParticle.Identity.getCurrentUser().setUserAttribute('id', 'id2');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                mpid: 'MPID2'
            }));
        };

        mParticle.Identity.login();

        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'female');
        mParticle.Identity.getCurrentUser().setUserAttribute('age', 45);
        mParticle.Identity.getCurrentUser().setUserAttribute('height', '80');
        mParticle.Identity.getCurrentUser().setUserAttribute('color', 'green');
        mParticle.Identity.getCurrentUser().setUserAttribute('id', 'id3');

        mParticle.useCookieStorage = true;

        mParticle.init(apiKey);
        var cookieData = findCookie();

        Should(cookieData['testMPID']).not.be.ok();
        cookieData['MPID1'].ua.should.have.property('id', 'id2');
        cookieData['MPID2'].ua.should.have.property('id');

        mParticle.useCookieStorage = false;

        done();
    });

    it('integration test - migrates all cookie MPIDs to localStorage', function(done) {
        mParticle.reset();
        mParticle.useCookieStorage = true;
        mParticle.isDevelopmentMode = true;

        mParticle.init(apiKey);
        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'female');
        mParticle.Identity.getCurrentUser().setUserAttribute('age', 30);
        mParticle.Identity.getCurrentUser().setUserAttribute('height', '68');
        mParticle.Identity.getCurrentUser().setUserAttribute('color', 'blue');
        mParticle.Identity.getCurrentUser().setUserAttribute('id', 'id1');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                mpid: 'MPID1'
            }));
        };

        mParticle.Identity.login();

        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'male');
        mParticle.Identity.getCurrentUser().setUserAttribute('age', 30);
        mParticle.Identity.getCurrentUser().setUserAttribute('height', '60');
        mParticle.Identity.getCurrentUser().setUserAttribute('color', 'green');
        mParticle.Identity.getCurrentUser().setUserAttribute('id', 'id2');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                mpid: 'MPID2'
            }));
        };

        mParticle.Identity.login();

        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'female');
        mParticle.Identity.getCurrentUser().setUserAttribute('age', 45);
        mParticle.Identity.getCurrentUser().setUserAttribute('height', '80');
        mParticle.Identity.getCurrentUser().setUserAttribute('color', 'green');
        mParticle.Identity.getCurrentUser().setUserAttribute('id', 'id3');

        mParticle.useCookieStorage = false;

        mParticle.init(apiKey);
        var lsData = getLocalStorage(v4LSKey);

        lsData.should.have.properties(['gs', 'cu', 'testMPID', 'MPID1', 'MPID2']);
        lsData['testMPID'].ua.should.have.properties(['gender', 'age', 'height', 'color', 'id']);
        lsData['MPID1'].ua.should.have.properties(['gender', 'age', 'height', 'color', 'id']);
        lsData['MPID2'].ua.should.have.properties(['gender', 'age', 'height', 'color', 'id']);

        done();
    });

    it('integration test - migrates all LS MPIDs to cookies', function(done) {
        mParticle.reset();
        mParticle.useCookieStorage = false;
        mParticle.isDevelopmentMode = true;

        mParticle.init(apiKey);
        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'female');
        mParticle.Identity.getCurrentUser().setUserAttribute('age', 30);
        mParticle.Identity.getCurrentUser().setUserAttribute('height', '68');
        mParticle.Identity.getCurrentUser().setUserAttribute('color', 'blue');
        mParticle.Identity.getCurrentUser().setUserAttribute('id', 'id1');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                mpid: 'MPID1'
            }));
        };

        mParticle.Identity.login();

        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'male');
        mParticle.Identity.getCurrentUser().setUserAttribute('age', 30);
        mParticle.Identity.getCurrentUser().setUserAttribute('height', '60');
        mParticle.Identity.getCurrentUser().setUserAttribute('color', 'green');
        mParticle.Identity.getCurrentUser().setUserAttribute('id', 'id2');

        server.handle = function(request) {
            request.setResponseHeader('Content-Type', 'application/json');
            request.receive(200, JSON.stringify({
                mpid: 'MPID2'
            }));
        };

        mParticle.Identity.login();

        mParticle.Identity.getCurrentUser().setUserAttribute('gender', 'female');
        mParticle.Identity.getCurrentUser().setUserAttribute('age', 45);
        mParticle.Identity.getCurrentUser().setUserAttribute('height', '80');
        mParticle.Identity.getCurrentUser().setUserAttribute('color', 'green');
        mParticle.Identity.getCurrentUser().setUserAttribute('id', 'id3');

        mParticle.useCookieStorage = true;

        mParticle.init(apiKey);
        var cookieData = findCookie();

        cookieData.should.have.properties(['gs', 'cu', 'testMPID', 'MPID1', 'MPID2']);
        cookieData['testMPID'].ua.should.have.properties(['gender', 'age', 'height', 'color', 'id']);
        cookieData['MPID1'].ua.should.have.properties(['gender', 'age', 'height', 'color', 'id']);
        cookieData['MPID2'].ua.should.have.properties(['gender', 'age', 'height', 'color', 'id']);
        mParticle.useCookieStorage = false;

        done();
    });
});
