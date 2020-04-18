// @ts-ignore
import Manifest from "./manifest.json";
import lambdaAtEdgeCompat from "next-aws-cloudfront";
import { CloudFrontS3Origin, CloudFrontOrigin, CloudFrontResultResponse } from "aws-lambda";
import type { CloudFrontRequest } from "aws-lambda";

export type OriginRequestEvent = {
  Records: [{ cf: { request: CloudFrontRequest } }];
};

export type NextLambdaOriginRequestManifest = {
  cloudFrontOrigins: {
    staticOrigin: {
      domainName: string;
    };
  };
  pages: {
    ssr: {
      dynamic: {
        [key: string]: {
          file: string;
          regex: string;
        };
      };
      nonDynamic: {
        [key: string]: string;
      };
    };
    html: {
      nonDynamic: {
        [path: string]: string;
      };
      dynamic: {
        [key: string]: {
          file: string;
          regex: string;
        };
      };
    };
  };
  publicFiles: {
    [key: string]: string;
  };
};

const router = (manifest: NextLambdaOriginRequestManifest) => {
  const {
    pages: { ssr, html }
  } = manifest;

  const allDynamicRoutes = { ...ssr.dynamic, ...html.dynamic };

  return (path: string) => {
    if (ssr.nonDynamic[path]) {
      return ssr.nonDynamic[path];
    }

    for (let route in allDynamicRoutes) {
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

const normaliseUri = (uri: string) => (uri === "/" ? "/index" : uri);

export const handler = async (event: OriginRequestEvent): Promise<CloudFrontResultResponse | CloudFrontRequest> => {
  const request = event.Records[0].cf.request;
  const uri = normaliseUri(request.uri);
  const manifest = Manifest as NextLambdaOriginRequestManifest;
  const { pages, publicFiles } = manifest;

  const isStaticPage = pages.html.nonDynamic[uri];
  const isPublicFile = publicFiles[uri];

  const origin = request.origin as CloudFrontOrigin;
  const s3Origin = origin.s3 as CloudFrontS3Origin;

  if (isStaticPage || isPublicFile) {
    s3Origin.path = isStaticPage ? "/static-pages" : "/public";

    if (isStaticPage) {
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

  const page = require(`./${pagePath}`);

  const { req, res, responsePromise } = lambdaAtEdgeCompat(event.Records[0].cf);

  page.render(req, res);

  return responsePromise;
};
