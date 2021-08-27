import { resultToChunks } from "next/dist/server/utils";
import { IncomingMessage, ServerResponse } from "http";

/**
 * Render to HTML helper. Starting in Next.js 11.1 a change was introduced so renderReqToHTML no longer returns a string.
 * See: https://github.com/vercel/next.js/pull/27319
 * This is a helper to properly render it in backwards compatible way.
 * @param page
 * @param req
 * @param res
 * @param renderMode
 */
export const renderPageToHtml = async (
  page: {
    renderReqToHTML: (
      req: IncomingMessage,
      res: ServerResponse,
      renderMode: string | boolean
    ) =>
      | PromiseLike<{ renderOpts: Record<string, any>; html: string }>
      | { renderOpts: Record<string, any>; html: string };
  },
  req: IncomingMessage,
  res: ServerResponse,
  renderMode: "export" | "passthrough" | true
): Promise<{ html: string; renderOpts: Record<string, any> }> => {
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
