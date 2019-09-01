const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const createRouter = require("./router");
const compatLayer = require("next-aws-lambda");
const manifest = require("./manifest.json");

module.exports = async (event, context) => {
  const router = createRouter(manifest);
  const pagePath = router(event.path);

  if (path.extname(pagePath) === ".html") {
    const readFileAsync = promisify(fs.readFile);
    const html = await readFileAsync(path.join(__dirname, pagePath), "utf-8");
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html"
      },
      body: html
    };
  } else {
    const page = require(pagePath);
    const pageHandler = compatLayer(page);
    return pageHandler(event, context);
  }
};
