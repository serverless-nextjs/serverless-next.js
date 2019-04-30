const reqResMapper = require("./lib/compatLayer");

const handlerFactory = page => (event, _context, callback) => {
  const { req, res } = reqResMapper(event, callback);
  page.render(req, res);
};

module.exports = handlerFactory;
