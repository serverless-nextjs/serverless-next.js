import lambdaAtEdgeCompat from "@sls-next/next-aws-cloudfront";
import { OriginRequestDefaultHandlerManifest } from "./types";
import { s3StorePage } from "./s3/s3StorePage";
import { cleanRequestUriForRouter } from "./lib/cleanRequestUriForRouter";

export const handler: AWSLambda.SQSHandler = async (event) => {
  await Promise.all(
    event.Records.map(async (record) => {
      const bucketName = record.messageAttributes.BucketName?.stringValue;
      const bucketRegion = record.messageAttributes.BucketRegion?.stringValue;
      const manifestString = record.messageAttributes.Manifest?.stringValue;
      const basePath = record.messageAttributes.BasePath?.stringValue;
      const cloudFrontEventRequestString =
        record.messageAttributes.CloudFrontEventRequest?.stringValue;
      if (
        !bucketName ||
        !bucketRegion ||
        !cloudFrontEventRequestString ||
        !manifestString
      ) {
        throw new Error(
          "Expected BucketName, BucketRegion, CloudFrontEventRequest & EnableHTTPCompression message attributes"
        );
      }
      const cloudFrontEventRequest: AWSLambda.CloudFrontRequest = JSON.parse(
        cloudFrontEventRequestString
      );
      const manifest: OriginRequestDefaultHandlerManifest = JSON.parse(
        manifestString
      );

      cloudFrontEventRequest.uri = cleanRequestUriForRouter(
        cloudFrontEventRequest.uri,
        manifest.trailingSlash
      );
      const { req, res } = lambdaAtEdgeCompat(
        { request: cloudFrontEventRequest },
        { enableHTTPCompression: manifest.enableHTTPCompression }
      );

      const baseKey = cloudFrontEventRequest.uri
        .replace(/\.(json|html)$/, "")
        .replace(/^_next\/data\/[^\/]*\//, "");

      let srcRoute = manifest.pages.ssg.nonDynamic[baseKey]?.srcRoute;
      if (!srcRoute) {
        const matchedDynamicRoute = Object.entries(
          manifest.pages.ssg.dynamic
        ).find(([, dynamicSsgRoute]) => {
          return new RegExp(dynamicSsgRoute.routeRegex).test(
            cloudFrontEventRequest.uri
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
        uri: cloudFrontEventRequest.uri,
        basePath,
        bucketName: bucketName || "",
        buildId: manifest.buildId,
        pageData: renderOpts.pageData,
        region: cloudFrontEventRequest.origin?.s3?.region || "",
        revalidate: renderOpts.revalidate
      });
    })
  );
};
