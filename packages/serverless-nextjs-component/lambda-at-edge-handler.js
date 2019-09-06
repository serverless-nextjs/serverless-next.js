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
  }

  const pagePath = router(manifest)(uri);

  const page = require(`./${pagePath}`);
  const { req, res, responsePromise } = cloudFrontCompat(event.Records[0].cf);
  if (page.render) {
    page.render(req, res);
  } else {
    page.default(req, res);
  }
  const response = await responsePromise;
  return response;
};
