// @ts-ignore
import PrerenderManifest from "./prerender-manifest.json";
// @ts-ignore
import Manifest from "./manifest.json";
import { PrerenderManifest as PrerenderManifestType } from "next/dist/build/index";
import lambdaAtEdgeCompat from "next-aws-cloudfront";
import {
  CloudFrontRequest,
  CloudFrontS3Origin,
  CloudFrontOrigin,
  CloudFrontResultResponse
} from "aws-lambda";
import {
  OriginRequestEvent,
  OriginRequestDefaultHandlerManifest
} from "./types";

const router = (
  manifest: OriginRequestDefaultHandlerManifest
): ((path: string) => string) => {
  const {
    pages: { ssr, html }
  } = manifest;

  const allDynamicRoutes = { ...ssr.dynamic, ...html.dynamic };

  return (path: string): string => {
    if (ssr.nonDynamic[path]) {
      return ssr.nonDynamic[path];
    }

    for (const route in allDynamicRoutes) {
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

const normaliseUri = (uri: string): string => (uri === "/" ? "/index" : uri);

export const handler = async (
  event: OriginRequestEvent
): Promise<CloudFrontResultResponse | CloudFrontRequest> => {
  const request = event.Records[0].cf.request;
  const uri = normaliseUri(request.uri);
  const manifest: OriginRequestDefaultHandlerManifest = Manifest;
  const prerenderManifest: PrerenderManifestType = PrerenderManifest;
  const { pages, publicFiles } = manifest;

  const isStaticPage = pages.html.nonDynamic[uri];
  const isPublicFile = publicFiles[uri];
  const isPrerenderedPage = prerenderManifest.routes[request.uri]; // prerendered pages are also static pages like "pages.html" above, but are defined in the prerender-manifest

  const origin = request.origin as CloudFrontOrigin;
  const s3Origin = origin.s3 as CloudFrontS3Origin;

  const isHTMLPage = isStaticPage || isPrerenderedPage;

  if (isHTMLPage || isPublicFile) {
    s3Origin.path = isHTMLPage ? "/static-pages" : "/public";

    if (isHTMLPage) {
      request.uri = uri + ".html";
    }

    return request;
  }

  const pagePath = router(manifest)(uri);

  if (pagePath.endsWith(".html")) {
    s3Origin.path = "/static-pages";
    request.uri = pagePath.replace("pages", "");
    return request;
  }

  const { req, res, responsePromise } = lambdaAtEdgeCompat(event.Records[0].cf);

  // eslint-disable-next-line
  const page = require(`./${pagePath}`);
  page.render(req, res);

  return responsePromise;
};
