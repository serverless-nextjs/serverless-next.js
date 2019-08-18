const router = require("./router");
const compatLayer = require("next-aws-lambda");

module.exports = async (event, _context, callback) => {
  const page = router(event.path);
  compatLayer(page)(event, callback);
};
