var assert = require('chai').assert;
var conf = require('./helpers/config');
var utils = require('./helpers/utils');
var request;

describe('auth:', function() {
  before(function (done) {
    request = utils.init();
    utils.login(request, function(err) {
      if (err) { return done(err); }
      done();
    });
  });

  it('no data', function (done) {
    request.post({ url: conf.url + '/auth/forgot',
                   form: { },
                 }, function (err, response, body) {
      assert.equal(response.statusCode, 400);
      done(err);
    });
  });
  it('no email', function (done) {
    request.post({ url: conf.url + '/auth/forgot',
                   form: { username: ' ' },
                 }, function (err, response, body) {
      assert.equal(response.statusCode, 400);
      done(err);
    });
  });
  it('invalid email', function (done) {
    request.post({ url: conf.url + '/auth/forgot',
                   form: { username: 'foobarbaz@@@slkdfjsldfkjsdlfkj' },
                 }, function (err, response, body) {
      assert.equal(response.statusCode, 400);
      done(err);
    });
  });
  it('request password reset', function (done) {
    request.post({ url: conf.url + '/auth/forgot',
                   form: { username: conf.defaultUser.username },
                 }, function (err, response, body) {
      assert.equal(response.statusCode, 200);
      var b = JSON.parse(body);
      assert.equal(b.success, true);
      // check that token is included
      assert.isDefined(b.token);
      // check that it has a value
      assert(b.token);
      done(err);
    });
  });
  it('valid email but no user account', function (done) {
    request.post({ url: conf.url + '/auth/forgot',
                   form: { username: 'midasuser@innovationgov.com' },
                 }, function (err, response, body) {
      assert.equal(response.statusCode, 200);
      var b = JSON.parse(body);
      assert.equal(b.success, true);
      assert.isUndefined(b.token);
      done(err);
    });
  });
});
