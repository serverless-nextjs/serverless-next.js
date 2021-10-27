import { resultsToString } from "next/dist/server/utils";
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
      renderMode?: "export" | "passthrough" | true
    ) =>
      | PromiseLike<{ renderOpts: Record<string, any>; html: any }>
      | { renderOpts: Record<string, any>; html: any };
  },
  req: IncomingMessage,
  res: ServerResponse,
  renderMode?: "export" | "passthrough" | true
): Promise<{ html: string; renderOpts: Record<string, any> }> => {
  const { renderOpts, html: htmlResult } = await page.renderReqToHTML(
    req,
    res,
    renderMode
  );

  let html = undefined;
  if (typeof htmlResult === "string") {
    html = htmlResult; // Next.js < 11.1
  } else {
    if (htmlResult) {
      html = await htmlResult.toUnchunkedString?.(); // Next >= 12

      if (!html) {
        try {
          html = await resultsToString([htmlResult]); // Next >= 11.1.1
        } catch (e) {
          console.log("html could not be rendered using resultsToString().");
        }
      }
    }
  }

  if (!html) {
    console.log(
      "html is empty, falling back to using page's rendering function for html"
    );
    html = (await page.renderReqToHTML(req, res)) as unknown as string;
  }

  return { html, renderOpts };
};
