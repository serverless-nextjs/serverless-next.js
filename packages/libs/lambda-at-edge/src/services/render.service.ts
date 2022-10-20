import lambdaAtEdgeCompat from "@getjerry/next-aws-cloudfront";
import { createETag } from "../lib/etag";
import { debug } from "../lib/console";

import { renderPageToHtml } from "./utils/render.util";

export class Page {
  constructor(
    private readonly json: Record<string, unknown>,
    private readonly html: string
  ) {}

  public getHtmlEtag(): string {
    return createETag().update(this.getHtmlBody()).digest();
  }

  public getJsonEtag(): string {
    return createETag().update(JSON.stringify(this.json)).digest();
  }

  public getHtmlBody(): string {
    return this.html;
  }

  public getJsonBody(): string {
    return JSON.stringify(this.json);
  }

  public getJson(): Record<string, unknown> {
    return this.json;
  }
}

/**
 * this is how s3 file json organized.
 */
export interface S3JsonFile {
  pageProps?: {
    contentfulCache?: [];
    initialApolloState?: any;
    preview?: boolean;
    generatedAt?: string;
  };
  __N_SSG?: string;
}

export class RenderService {
  constructor(private readonly event: any) {}

  public async getPage(
    pagePath?: string,
    rewrittenUri?: string
  ): Promise<Page | undefined> {
    debug(`[render] Page path: ${pagePath}`);

    // eslint-disable-next-line
    const page = require(`./${pagePath}`);

    if (!page?.getStaticProps) {
      return;
    }

    const { req, res } = lambdaAtEdgeCompat(this.event.Records[0].cf, {
      enableHTTPCompression: false,
      rewrittenUri
    });

    const { renderOpts, html } = await renderPageToHtml(
      page,
      req,
      res,
      "passthrough"
    );

    debug(`[render] Rendered HTML: ${html}`);
    debug(`[render] Rendered options: ${JSON.stringify(renderOpts)}`);

    return new Page(renderOpts.pageData, html);
  }
}
