import lambdaAtEdgeCompat from "@getjerry/next-aws-cloudfront";
import { createETag } from "../lib/etag";
import { debug } from "../lib/console";

export class Page {
  constructor(
    private readonly json: Record<string, unknown>,
    // TODO: support older version.
    private readonly html: string | { _result: string }
  ) {}

  public getHtmlEtag() {
    return createETag().update(this.getHtmlBody()).digest();
  }

  public getJsonEtag() {
    return createETag().update(JSON.stringify(this.json)).digest();
  }

  public getHtmlBody() {
    return typeof this.html === "string" ? this.html : this.html._result;
  }

  public getJsonBody() {
    return JSON.stringify(this.json);
  }

  public getJson() {
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

    const { renderOpts, html } = await page.renderReqToHTML(
      req,
      res,
      "passthrough"
    );

    debug(`[render] Rendered HTML: ${html._result}`);
    debug(`[render] Rendered options: ${JSON.stringify(renderOpts)}`);

    return new Page(renderOpts.pageData, html);
  }
}
