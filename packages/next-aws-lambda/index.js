const reqResMapper = require("./lib/compatLayer");

const handlerFactory = page => (event, _context, callback) => {
  const { req, res, responsePromise } = reqResMapper(event, callback);
  if (page.render instanceof Function) {
    // Is a React component
    page.render(req, res);
  } else {
    // Is an API
    page.default(req, res);
  }

  if (responsePromise) {
    return responsePromise;
  }
};

module.exports = handlerFactory;
