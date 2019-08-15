const serve = require("serverless-nextjs-plugin/lib/serveFile");

module.exports.render = e => serve(__dirname, "static", e);
