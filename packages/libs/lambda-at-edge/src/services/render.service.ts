import lambdaAtEdgeCompat from "@getjerry/next-aws-cloudfront";
import { createETag } from "../lib/etag";

class Page {
  constructor(
    private readonly json: Record<string, unknown>,
    private readonly html: string
  ) {}

  public getHtmlEtag() {
    return createETag().update(this.html).digest();
  }

  public getJsonEtag() {
    return createETag().update(JSON.stringify(this.json)).digest();
  }

  public getHtmlBody() {
    return JSON.stringify(this.json);
  }

  public getJsonBody() {
    return this.html;
  }
}

export class RenderService {
  constructor(private readonly event: any) {}

  public async getPage(pagePath?: string): Promise<Page | undefined> {
    // eslint-disable-next-line
    const page = require(`./${pagePath}`);

    if (!page?.getStaticProps) {
      return;
    }

    const { req, res } = lambdaAtEdgeCompat(this.event.Records[0].cf, {
      enableHTTPCompression: false
    });

    const { renderOpts, html } = await page.renderReqToHTML(
      req,
      res,
      "passthrough"
    );

    return new Page(renderOpts.pageData, html);
  }
}
