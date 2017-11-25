const uuid = require('uuid/v4');
const _ = require('lodash');
const httpHeaders = require('http-headers');

const BLACKOUT_STRING = '---';

function reqSerializer(req) {
  if (!req || !req.connection) {
    return req;
  }
  return {
    method: req.method,
    url: req.url,
    headers: req.headers,
    remoteAddress: req.connection.remoteAddress,
    remotePort: req.connection.remotePort,
    useragent: req.useragent
  };
}

function resSerializer(res) {
  if (!res || !res.statusCode) {
    return res;
  }
  return {
    statusCode: res.statusCode,
    headers: httpHeaders(res)
  };
}

function geoip(req){
  if (!req || !req.connection) {
    return null;
  }
  let header = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if (typeof header === 'string') {
    header = header.split(',');
  }
  return header ? header.shift() : null;
}

module.exports = function logRequest(options) {
  const logger = options.logger;
  const headerName = options.headerName || 'x-request-id';

  return function (req, res, next) {
    const id = req.headers[headerName] || uuid();
    const startOpts = {};

    const serializers = {
      err: logger.constructor.stdSerializers.err,
      req: reqSerializer,
      res: resSerializer
    };

    req.log = logger.child({
      type: 'request',
      id: id,
      req,
      serializers,
      '__geoip': geoip(req)
    });

    if (req.body) {
      // clone data since we may modify it
      startOpts.body = _.cloneDeep(req.body);
      if (options.blacklist) {
        options.blacklist.forEach((bl) => {
          if (_.has(startOpts.body, bl)) {
            _.set(startOpts.body, bl, BLACKOUT_STRING);
          }
        });
      }
    }

    res.setHeader(headerName, id);

    req.log.debug(startOpts, 'start request');

    const time = process.hrtime();
    res.on('finish', function responseSent() {
      const diff = process.hrtime(time);
      req.log.debug({
        res: res,
        metric_duration: diff[0] * 1e3 + diff[1] * 1e-6
      }, 'end request');
    });

    next();
  };
};