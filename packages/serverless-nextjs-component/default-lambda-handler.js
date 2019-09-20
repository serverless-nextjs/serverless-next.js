const manifest = require("./manifest.json");
const cloudFrontCompat = require("./next-aws-cloudfront");

const router = manifest => {
  const {
    pages: {
      ssr: { dynamic, nonDynamic },
      html
    }
  } = manifest;

  return path => {
    if (nonDynamic[path]) {
      return nonDynamic[path];
    }

    if (html[path]) {
      return html[path];
    }

    for (route in dynamic) {
      const { file, regex } = dynamic[route];

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

  const isStaticPage = pages.html[uri];
  const isPublicFile = publicFiles[uri];

  if (isStaticPage || isPublicFile) {
    request.origin.s3.path = isStaticPage ? "/static-pages" : "/public";

    if (isStaticPage) {
      request.uri = uri + ".html";
    }

    return request;
  }

  const pagePath = router(manifest)(uri);

  const page = require(`./${pagePath}`);
  const { req, res, responsePromise } = cloudFrontCompat(event.Records[0].cf);

  page.render(req, res);

  return responsePromise;
};
