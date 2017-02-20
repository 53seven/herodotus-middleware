const uuid = require('uuid/v4');

module.exports = function logRequest(options) {
  const logger = options.logger;
  const headerName = options.headerName || 'x-request-id';

  return function (req, res, next) {
    const id = req.headers[headerName] || uuid.v4();
    const startOpts = {req: req};

    req.log = logger.child({
      type: 'request',
      id: id,
      serializers: logger.constructor.stdSerializers
    });

    if (req.body) {
      startOpts.body = req.body;
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