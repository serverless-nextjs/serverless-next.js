const manifest = require("./manifest.json");
const cloudFrontCompat = require("./next-aws-cloudfront");

const router = manifest => {
  const {
    pages: { ssr, html }
  } = manifest;

  const allDynamicRoutes = { ...ssr.dynamic, ...html.dynamic };

  return path => {
    if (ssr.nonDynamic[path]) {
      return ssr.nonDynamic[path];
    }

    for (route in allDynamicRoutes) {
      const { file, regex } = allDynamicRoutes[route];

      const re = new RegExp(regex, "i");
      const pathMatchesRoute = re.test(path);

      if (pathMatchesRoute) {
        return file;
      }
    }

    // path didn't match any route, return error page
    return "pages/_error.js";
  };
};

const normaliseUri = uri => (uri === "/" ? "/index" : uri);

exports.handler = async event => {
  const request = event.Records[0].cf.request;
  const uri = normaliseUri(request.uri);
  const { pages, publicFiles } = manifest;

  const isStaticPage = pages.html.nonDynamic[uri];
  const isPublicFile = publicFiles[uri];

  if (isStaticPage || isPublicFile) {
    request.origin.s3.path = isStaticPage ? "/static-pages" : "/public";

    if (isStaticPage) {
      request.uri = uri + ".html";
    }

    return request;
  }

  const pagePath = router(manifest)(uri);

  if (pagePath.endsWith(".html")) {
    request.origin.s3.path = "/static-pages";
    request.uri = pagePath.replace("pages", "");
    return request;
  }

  const page = require(`./${pagePath}`);

  const { req, res, responsePromise } = cloudFrontCompat(event.Records[0].cf);

  page.render(req, res);

  return responsePromise;
};
