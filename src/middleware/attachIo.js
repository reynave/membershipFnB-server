/**
 * Middleware to attach Socket.IO instance to request
 * Usage: app.use(attachIoToRequest(io))
 */
const attachIoToRequest = (io) => {
  return (_req, _res, next) => {
    _req.io = io;
    next();
  };
};

module.exports = {
  attachIoToRequest
};
