const path = require("path");
const fs = require("fs");
const createRouter = require("./router");
const compatLayer = require("next-aws-lambda");
const manifest = require("./manifest.json");

module.exports = (event, context, callback) => {
  const router = createRouter(manifest);

  const pagePath = router(event.path);

  if (path.extname(pagePath) === ".html") {
    fs.readFile(path.join(__dirname, pagePath), "utf-8", function(err, html) {
      if (err) callback(err);

      callback(null, {
        statusCode: 200,
        headers: {
          "Content-Type": "text/html"
        },
        body: html
      });
    });

    return;
  } else {
    const page = require(pagePath);
    const pageHandler = compatLayer(page);

    pageHandler(event, context, callback);
  }
};
