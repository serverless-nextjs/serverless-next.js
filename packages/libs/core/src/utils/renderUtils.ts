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
      | PromiseLike<{ renderOpts: Record<string, any>; html: string }>
      | { renderOpts: Record<string, any>; html: string };
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

  let html;
  try {
    if (typeof htmlResult === "string") {
      html = htmlResult; // Next.js < 11.1
    } else {
      html = htmlResult ? await resultsToString([htmlResult]) : ""; // Next >= 11.1.1
    }
  } catch (e) {
    // Fallback to using renderReqToHtml without renderMode specified,
    // which will render html based on the page's renderReqToHtml,
    // which should always work (but adds another *warm* render cost)
    console.log(
      "Exception occurred, falling back to using page's rendering function for html"
    );
    html = (await page.renderReqToHTML(req, res)) as unknown as string;
  }

  if (!html || html === "") {
    console.log(
      "html is empty, falling back to using page's rendering function for html"
    );
    html = (await page.renderReqToHTML(req, res)) as unknown as string;
  }

  return { html, renderOpts };
};
