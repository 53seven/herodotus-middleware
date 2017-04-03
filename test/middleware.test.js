/* global describe, it, beforeEach */
const pck = require('../package.json');
const herodotus = require('herodotus');
const middleware = require('../');
const chai = require('chai');
const _ = require('lodash');
const expect = chai.expect;

describe('herodotus-middleware', () => {
  // shim in a token so that we can capture the transport
  process.env.HERODOTUS_TOKEN = 'a token';

  let req, res, finishCallback, minor_count = 0;

  let loggerOpts;

  beforeEach(() => {
    pck.version = `0.0.${minor_count}`;
    minor_count++;
    finishCallback = null;
    req = {
      headers: {},
      connection: {},
      method: 'GET',
      url: '/a/url'
    };
    res = {statusCode: 200, _header: 'name: value'};
    res.on = function(evt, callback) {
      finishCallback = callback;
    };
    res.setHeader = () => {};
    loggerOpts = {};
  });

  function boostrapServer(callback) {
    let logs = [];
    const transport = function() {
      this.write = function(data) {
        logs.push(data);
      };
      return this;
    };
    let logger = herodotus(pck, transport);
    loggerOpts.logger = logger;
    let layer = middleware(loggerOpts);
    layer(req, res, () => {
      process.nextTick(() => {
        req.log.info('msg');
        process.nextTick(() => {
          finishCallback();
          callback(logs);
        });
      });
    });
  }

  it('should return a middleware that logs to herodotus', (done) => {
    boostrapServer((out) => {
      expect(out).to.have.lengthOf(3);

      // expect the request information to exist on all log
      expect(out[0]).to.have.property('req');
      expect(out[1]).to.have.property('req');
      expect(out[2]).to.have.property('req');

      // expect the result log to have parsed HTTP headers
      expect(out[2]).to.have.property('res');
      expect(out[2].res.header).to.have.property('name', 'value');


      // expect all  the request ids to be the same
      expect(_.uniq(_.map(out, 'id'))).to.have.lengthOf(1);
      done();
    });
  });

  it('should log data from the post body', (done) => {
    req.body = {foo: 'bar'};
    boostrapServer((out) => {
      expect(out).to.have.lengthOf(3);
      expect(out[0]).to.have.property('body');
      expect(out[0].body).to.have.property('foo', 'bar');

      // but this should not exist on all logs object
      expect(out[1]).to.not.have.property('body');

      // expect all  the request ids to be the same
      expect(_.uniq(_.map(out, 'id'))).to.have.lengthOf(1);
      done();
    });
  });

  it('should omit blocked body keys', (done) => {
    req.body = {
      password: 'secret data for secret logins',
      username: 'publik_data',
      foo: {
        bar: 'nested secret'
      }
    };
    loggerOpts.blacklist = ['password', 'another_secret', 'foo.bar'];
    boostrapServer((out) => {
      expect(out).to.have.lengthOf(3);
      expect(out[0]).to.have.property('body');
      expect(out[0].body).to.have.property('password', '---');
      expect(out[0].body).to.have.property('username', req.body.username);
      expect(out[0].body.foo).to.have.property('bar', '---');

      // but this should not exist on all logs object
      expect(out[1]).to.not.have.property('body');

      // expect all  the request ids to be the same
      expect(_.uniq(_.map(out, 'id'))).to.have.lengthOf(1);
      done();
    });
  });

  it('should be ok with malformed req, res objects', (done) => {
    req.connection = null;
    res.statusCode = null;
    boostrapServer((out) => {
      expect(out).to.have.lengthOf(3);

      done();
    });
  });

});