const fs = require("fs");
const manifest = require("./manifest.json");
const cloudFrontCompat = require("./next-aws-cloudfront");
const router = require("./router");

exports.handler = async event => {
  const request = event.Records[0].cf.request;
  const uri = request.uri;
  const { pages, publicFiles } = manifest;

  const isStaticPage = pages.html[uri];
  const isPublicFile = publicFiles[uri];

  if (isStaticPage || isPublicFile) {
    request.origin.s3.path = isStaticPage ? "/static-pages" : "/public";

    if (isStaticPage) {
      request.uri = request.uri + ".html";
    }

    return request;
  } else {
    const pagePath = router(manifest)(uri);

    if (!pagePath.includes("_error.js")) {
      const page = require(`${pagePath}`);
      const { req, res, responsePromise } = cloudFrontCompat(
        event.Records[0].cf
      );
      page.render(req, res);
      const response = await responsePromise;
      return response;
    }
  }

  return request;
};
