import { resultToChunks } from "next/dist/server/utils";
import { IncomingMessage, ServerResponse } from "http";

/**
 * Render to HTML helper. Starting in Next.js 11.1 a change was introduced so renderReqToHTML no longer returns a string.
 * See: https://github.com/vercel/next.js/pull/27319
 * This is a helper to properly render it in either format.
 * @param page
 * @param req
 * @param res
 * @param renderMode
 */
export const renderPageToHtml = async (
  page: any, // @ts-ignore
  req: IncomingMessage,
  res: ServerResponse,
  renderMode: "export" | "passthrough" | true
) => {
  const { renderOpts, html: htmlResult } = await page.renderReqToHTML(
    req,
    res,
    renderMode
  );

  let html;
  if (typeof htmlResult === "string") {
    html = htmlResult;
  } else {
    const htmlChunks = htmlResult ? await resultToChunks(htmlResult) : [];
    html = htmlChunks.join("");
  }

  return { html, renderOpts };
};
