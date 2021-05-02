import lambdaAtEdgeCompat from "@sls-next/next-aws-cloudfront";
// @ts-ignore
import Manifest from "./manifest.json";
import {
  OriginRequestDefaultHandlerManifest,
  RegenerationEvent
} from "./types";
import { s3StorePage } from "./s3/s3StorePage";
import { cleanRequestUriForRouter } from "./lib/cleanRequestUriForRouter";

export const handler: AWSLambda.Handler<RegenerationEvent> = async (event) => {
  const manifest: OriginRequestDefaultHandlerManifest = Manifest;
  event.cloudFrontEventRequest.uri = cleanRequestUriForRouter(
    event.cloudFrontEventRequest.uri,
    manifest.trailingSlash
  );
  const { req, res } = lambdaAtEdgeCompat(
    { request: event.cloudFrontEventRequest },
    { enableHTTPCompression: manifest.enableHTTPCompression }
  );

  const baseKey = event.cloudFrontEventRequest.uri
    .replace(/\.(json|html)$/, "")
    .replace(/^_next\/data\/[^\/]*\//, "");

  let srcRoute = manifest.pages.ssg.nonDynamic[baseKey]?.srcRoute;
  if (!srcRoute) {
    const matchedDynamicRoute = Object.entries(manifest.pages.ssg.dynamic).find(
      ([, dynamicSsgRoute]) => {
        return new RegExp(dynamicSsgRoute.routeRegex).test(
          event.cloudFrontEventRequest.uri
        );
      }
    );

    if (matchedDynamicRoute) {
      [srcRoute] = matchedDynamicRoute;
    }
  }

  // We probably should not get to this point without `srcRoute` being
  // defined
  const srcPath = srcRoute || baseKey;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const page = require(`./pages${srcPath}`);

  const { renderOpts, html } = await page.renderReqToHTML(
    req,
    res,
    "passthrough"
  );

  await s3StorePage({
    html,
    uri: event.cloudFrontEventRequest.uri,
    basePath: event.basePath,
    bucketName: event.bucketName,
    buildId: manifest.buildId,
    pageData: renderOpts.pageData,
    region: event.cloudFrontEventRequest.origin?.s3?.region || "",
    revalidate: renderOpts.revalidate
  });
};
