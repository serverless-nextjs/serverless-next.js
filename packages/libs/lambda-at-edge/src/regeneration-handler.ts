import lambdaAtEdgeCompat from "@sls-next/next-aws-cloudfront";
// @ts-ignore
import Manifest from "./manifest.json";
import {
  OriginRequestDefaultHandlerManifest,
  RegenerationEvent
} from "./types";
import { s3StorePage } from "./s3/s3StorePage";
import { cleanRequestUriForRouter } from "./lib/cleanRequestUriForRouter";

export const handler = async (event: AWSLambda.SQSEvent): Promise<void> => {
  await Promise.all(
    event.Records.map(async (record) => {
      const regenerationEvent: RegenerationEvent = JSON.parse(record.body);

      const manifest: OriginRequestDefaultHandlerManifest = Manifest;
      regenerationEvent.cloudFrontEventRequest.uri = cleanRequestUriForRouter(
        regenerationEvent.cloudFrontEventRequest.uri,
        manifest.trailingSlash
      );
      const { req, res } = lambdaAtEdgeCompat(
        { request: regenerationEvent.cloudFrontEventRequest },
        { enableHTTPCompression: manifest.enableHTTPCompression }
      );

      const baseKey = regenerationEvent.cloudFrontEventRequest.uri
        .replace(/\.(json|html)$/, "")
        .replace(/^_next\/data\/[^\/]*\//, "");

      let srcRoute = manifest.pages.ssg.nonDynamic[baseKey]?.srcRoute;
      if (!srcRoute) {
        const matchedDynamicRoute = Object.entries(
          manifest.pages.ssg.dynamic
        ).find(([, dynamicSsgRoute]) => {
          return new RegExp(dynamicSsgRoute.routeRegex).test(
            regenerationEvent.cloudFrontEventRequest.uri
          );
        });

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
        uri: regenerationEvent.cloudFrontEventRequest.uri,
        basePath: regenerationEvent.basePath,
        bucketName: regenerationEvent.bucketName,
        buildId: manifest.buildId,
        pageData: renderOpts.pageData,
        region:
          regenerationEvent.cloudFrontEventRequest.origin?.s3?.region || "",
        revalidate: renderOpts.revalidate
      });
    })
  );
};
