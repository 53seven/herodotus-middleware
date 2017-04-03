const uuid = require('uuid/v4');
const _ = require('lodash');

const BLACKOUT_STRING = '---';

module.exports = function logRequest(options) {
  const logger = options.logger;
  const headerName = options.headerName || 'x-request-id';

  return function (req, res, next) {
    const id = req.headers[headerName] || uuid();
    const startOpts = {};

    req.log = logger.child({
      type: 'request',
      id: id,
      req,
      serializers: logger.constructor.stdSerializers
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
        '@metric': {
          duration: diff[0] * 1e3 + diff[1] * 1e-6
        }
      }, 'end request');
    });

    next();
  };
};