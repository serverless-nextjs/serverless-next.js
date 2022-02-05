// @ts-ignore
process.env.NODE_ENV = "production";
process.chdir(__dirname);

import type { CloudFrontResultResponse } from "aws-lambda";
import type { OriginRequestEvent, OriginResponseEvent } from "./types";

import lambdaAtEdgeCompat from "@sls-next/next-aws-cloudfront";
import NextServer from "next/dist/server/next-server";
import { join } from "path";

// @ts-ignore
import Manifest from "./manifest.json";
// @ts-ignore
import RequiredServerFiles from "./.next/required-server-files.json";

export const handler = async (
  event: OriginRequestEvent | OriginResponseEvent
): Promise<CloudFrontResultResponse> => {
  const { req, res, responsePromise } = lambdaAtEdgeCompat(
    event.Records[0].cf,
    { enableHTTPCompression: Manifest.enableHTTPCompression }
  );

  const nextServer = new NextServer({
    // Next.js compression should be disabled because of a bug
    // in the bundled `compression` package. See:
    // https://github.com/vercel/next.js/issues/11669
    conf: { ...RequiredServerFiles.config, compress: false },
    customServer: true,
    dev: false,
    dir: join(__dirname),
    // @ts-ignore
    minimalMode: true
  });

  const requestHandler = nextServer.getRequestHandler();
  await requestHandler(req, res);

  return responsePromise;
};
