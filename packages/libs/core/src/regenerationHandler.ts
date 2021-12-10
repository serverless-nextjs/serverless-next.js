// eslint-disable-next-line @typescript-eslint/no-var-requires
import { renderPageToHtml } from "./utils";
import { IncomingMessage, ServerResponse } from "http";
import { PageManifest, RegenerationEvent } from "./types";
import { PlatformClient } from "./platform";

export const regenerationHandler = async ({
  req,
  res,
  regenerationEvent,
  manifest,
  platformClient
}: {
  req: IncomingMessage;
  res: ServerResponse;
  regenerationEvent: RegenerationEvent;
  manifest: PageManifest;
  platformClient: PlatformClient;
}): Promise<void> => {
  const page = require(`./${regenerationEvent.pagePath}`);

  const { renderOpts, html } = await renderPageToHtml(
    page,
    req,
    res,
    "passthrough"
  );

  const normalizedUri = regenerationEvent.pageKey
    .replace(`static-pages/${manifest.buildId}`, "")
    .replace(".js", "");

  await platformClient.storePage({
    html,
    uri: normalizedUri,
    basePath: regenerationEvent.basePath,
    buildId: manifest.buildId,
    pageData: renderOpts.pageData,
    revalidate: renderOpts.revalidate as number
  });
};
