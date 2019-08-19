const createRouter = require("./router");
const compatLayer = require("next-aws-lambda");
const manifest = require("./manifest.json");

module.exports = (event, context, callback) => {
  const router = createRouter(manifest);

  const pagePath = router(event.path);
  const page = require(pagePath);
  const pageHandler = compatLayer(page);

  pageHandler(event, context, callback);
};
