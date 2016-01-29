
/**
 * Module dependencies.
 */

var CAS = require('../lib/cas')
    , should = require('should')
    , nock = require('nock');

var base_url = 'https://localhost/cas',
    service = 'test_service',
    sso_servers = ['test_remote_address'],
    cas = new CAS({
        base_url: base_url,
        service: service,
        version: 2.0,
        sso_servers: sso_servers
    });

module.exports = {
    'test .version': function () {
        CAS.version.should.match(/^\d+\.\d+\.\d+$/);
    },


    'handleSingleSignout - should return valid ticket in callback': function () {
        var ticket = 'TICKET';

        var req = {
            method: 'POST',
            body: {
                logoutRequest: '<samlp:LogoutRequest>' + 
                                    '<samlp:SessionIndex>' + 
                                        ticket + 
                                    '</samlp:SessionIndex>' +
                               '</samlp:LogoutRequest>'
            },
            connection: {
                remoteAddress: sso_servers[0]
            }
        };
        var res = {};
        var next = function () {
            should.not.exist(true, 'should not call this function');
        };
        var logoutCallback = function (result) {
            ticket.should.equal(result, 'should return valid ticket');
        };

        cas.handleSingleSignout(req, res, next, logoutCallback);
    },


    'validate - should return valid ticket information': function () {
        var ticket = "TICKET";
        var user = "USERNAME";
        var attributes = {
            attrastyle: ['RubyCAS'],
            surname: ['Smith'],
            givenname: ['John'],
            memberof: ['CN=Staff,OU=Groups,DC=example,DC=edu', 'CN=Spanish Department,OU=Departments,...']
        };
        var attributesTag = '<cas:attributes>' +
                                '<cas:attraStyle>' + attributes.attrastyle[0] + '</cas:attraStyle>' +
                                '<cas:surname>' + attributes.surname[0] + '</cas:surname>' +
                                '<cas:givenName>' + attributes.givenname[0] + '</cas:givenName>' +
                                '<cas:memberOf>' + attributes.memberof[0] + '</cas:memberOf>' +
                                '<cas:memberOf>' + attributes.memberof[1] + '</cas:memberOf>' +
                            '</cas:attributes>';
        var proxyGrantingTicket = "PROXY_GRANTING_TICKET";
        var proxies = ['proxy1', 'proxy2'];
        var proxiesTag = '';
        proxies.forEach(function (proxy) {
            proxiesTag += '<cas:proxies>' + proxy + '</cas:proxies>';
        });

        nock(base_url)
            .get('/proxyValidate')
            .query({ ticket: ticket, service: service })
            .reply(200,
                '<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">' +
                    '<cas:authenticationSuccess>' +
                        '<cas:user>' + user + '</cas:user>' +
                        attributesTag +
                        '<cas:proxyGrantingTicket>' + proxyGrantingTicket + '</cas:proxyGrantingTicket>' +
                        proxiesTag +
                    '</cas:authenticationSuccess>' +
                '</cas:serviceResponse>');

        var callback = function (err, one, username, ticketInfo) {
            should.not.exist(err, 'should not have any errors');

            one.should.equal(true);

            should.exist(username, 'should have username');
            user.should.equal(username, 'should return valid username');

            should.exist(ticketInfo, 'should have ticketInfo');

            should.exist(ticketInfo.username, 'should have username property');
            user.should.equal(ticketInfo.username, 'should have username');

            should.exist(ticketInfo.attributes, 'should have attributes property');
            attributes.should.deepEqual(ticketInfo.attributes, 'should have attributes');

            should.exist(ticketInfo.PGTIOU, 'should have PGTIOU property');
            proxyGrantingTicket.should.equal(ticketInfo.PGTIOU, 'should have PGTIOU property');

            should.exist(ticketInfo.ticket, 'should have ticket property');
            ticket.should.equal(ticketInfo.ticket, 'should return valid ticket property');

            should.exist(ticketInfo.proxies, 'should have proxies property');
            proxies.should.deepEqual(ticketInfo.proxies, 'should return valid proxies');
        };

        cas.validate(ticket, callback, service, null);
    },


    'getProxyTicket - should return valid proxy ticket': function () {
        var proxyTicket = 'TEST proxyTicket';
        var pgtID = 'TEST pgtID';
        var pgtIOU = 'TEST pgtIOU';

        cas.pgtStore[pgtIOU] = {
            'pgtID': pgtID,
            'time': process.uptime()
        };

        nock(base_url)
            .get('/proxy')
            .query({ targetService: service, pgt: pgtID })
            .reply(200, '<cas:serviceResponse>' +
                            '<cas:proxySuccess>' +
                                '<cas:proxyTicket>' + proxyTicket + '</cas:proxyTicket>' +
                            '</cas:proxySuccess>' +
                        '</cas:serviceResponse>');

        var callback = function (err, returnProxyTicket) {
            should.not.exist(err, 'should not have any errors');

            should.exist(returnProxyTicket, 'should have proxy ticket');
            proxyTicket.should.equal(returnProxyTicket, 'should return valid proxy ticket');
        };

        cas.getProxyTicket(pgtIOU, service, callback);
    },
    
    'getProxyTicket - should return proxy failure error': function () {
        var pgtID = 'TEST pgtID';
        var pgtIOU = 'TEST pgtIOU';

        cas.pgtStore[pgtIOU] = {
            'pgtID': pgtID,
            'time': process.uptime()
        };

        var errorCode = 500;
        var errorMessage = 'TEST Error message';

        nock(base_url)
            .get('/proxy')
            .query({ targetService: service, pgt: pgtID })
            .reply(200, '<cas:serviceResponse>' +
                            '<cas:proxyFailure code="' + errorCode + '">' +
                                errorMessage +
                            '</cas:proxyFailure>' +
                        '</cas:serviceResponse>');
                        
        var callback = function(err, returnProxyTicket) {
            should.exist(err, 'should have a error');
            err.message.should.equal('Proxy failure [' + errorCode + ']: ' + errorMessage, 'should return valid error message');
            
            should.not.exist(returnProxyTicket, 'should not return any tickets');
        };

        cas.getProxyTicket(pgtIOU, service, callback);
    }

};