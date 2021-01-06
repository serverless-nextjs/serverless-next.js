import { Context } from "aws-lambda";

import { RevalidationEvent } from "../../types";
import { CloudFrontService } from "../services/cloudfront.service";
import { RenderService } from "../services/render.service";
import { ResourceService } from "../services/resource.service";
import { S3Service } from "../services/s3.service";
import { debug } from "../lib/console";

export class RevalidateHandler {
  constructor(
    private resourceService: ResourceService,
    private renderService: RenderService,
    private s3Service: S3Service,
    private cloudfrontService: CloudFrontService
  ) {}

  public async run(event: RevalidationEvent, context: Context): Promise<void> {
    const resource = this.resourceService.get(event);
    console.log(resource);
    console.log(JSON.stringify(event));
    console.log(JSON.stringify(context));

    const [htmlHeader, jsonHeader, candidatePage] = await Promise.all([
      this.s3Service.getHeader(resource.getHtmlKey()),
      this.s3Service.getHeader(resource.getJsonKey()),
      this.renderService.getPage(resource.getPagePath(), resource.getJsonUri())
    ]);

    debug(`[handler] Revalidate resource: ${JSON.stringify(resource)}`);

    if (!candidatePage) {
      throw new Error(`Page for ${resource.getPagePath()} not found`);
    }

    console.log(`JSON CANDIDATE ETAG: ${candidatePage.getJsonEtag()}`);
    console.log(`HTML CANDIDATE ETAG: ${candidatePage.getHtmlEtag()}`);
    console.log(`CANDIDATE PAGE: ${JSON.stringify(candidatePage)}`);

    if (
      htmlHeader.getETag() !== candidatePage.getHtmlEtag() ||
      jsonHeader.getETag() !== candidatePage.getJsonEtag()
    ) {
      debug(`[handler] Resource changed, update S3 cache and invalidate`);

      await Promise.all([
        this.s3Service.putObject(
          resource.getHtmlKey(),
          candidatePage.getHtmlBody()
        ),
        this.s3Service.putObject(
          resource.getJsonKey(),
          candidatePage.getJsonBody()
        )
      ]);

      await this.cloudfrontService.createInvalidation([
        resource.getHtmlUri(),
        resource.getJsonUri()
      ]);
    }

    return;
  }
}
