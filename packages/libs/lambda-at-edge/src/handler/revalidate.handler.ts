import { Context } from "aws-lambda";

import {
  OriginRequestDefaultHandlerManifest,
  RevalidationEvent
} from "../../types";
import { CloudFrontService } from "../services/cloudfront.service";
import { Page, RenderService, S3JsonFile } from "../services/render.service";
import { ResourceService } from "../services/resource.service";
import { S3Service } from "../services/s3.service";
import { debug, getEnvironment, isDevMode } from "../lib/console";
import { Resource, ResourceForIndexPage } from "../services/resource";
// @ts-ignore
import * as _ from "../lib/lodash";
import { isEqual, omit } from "lodash";

export class RevalidateHandler {
  constructor(
    private resourceService: ResourceService,
    private renderService: RenderService,
    private s3Service: S3Service,
    private cloudfrontService: CloudFrontService
  ) {}

  public async run(
    event: RevalidationEvent,
    context: Context,
    manifest: OriginRequestDefaultHandlerManifest,
    cacheControl?: string
  ): Promise<void> {
    const resource = this.resourceService.get(event);

    console.log(JSON.stringify(resource));

    debug(JSON.stringify(event));
    debug(JSON.stringify(context));

    const [htmlHeader, jsonHeader, candidatePage] = await Promise.all([
      this.s3Service.getHeader(resource.getHtmlKey()),
      this.s3Service.getHeader(resource.getJsonKey()),
      this.renderService.getPage(resource.getPagePath(), resource.getJsonUri())
    ]);

    // ISR needs to maintain a time gap of at least tens of seconds.
    const revalidateTriggerGapSecond = isDevMode() ? 1 : 300;
    if (
      this.shouldSkipRevalidate(
        htmlHeader.header.LastModified,
        revalidateTriggerGapSecond
      )
    ) {
      debug(
        `The last ISR was triggered ${revalidateTriggerGapSecond} seconds ago, so skip this one.`
      );
      return;
    }

    debug(`[handler] Revalidate resource: ${JSON.stringify(resource)}`);

    if (!candidatePage) {
      throw new Error(`Page for ${resource.getPagePath()} not found`);
    }

    debug(
      `Current HTML ETAG: ${htmlHeader.getETag()}, Candidate Page HTML ETAG: ${candidatePage.getHtmlEtag()}`
    );

    debug(
      `Current JSON ETAG: ${jsonHeader.getETag()}, Candidate Page JSON ETAG: ${candidatePage.getJsonEtag()}`
    );

    debug(`CANDIDATE PAGE: ${JSON.stringify(candidatePage)}`);

    if ((await this.isContentChanged(candidatePage, resource)) || isDevMode()) {
      debug(
        `[handler] isDevMode():${isDevMode()} or resource changed, update S3 cache and invalidate. html: ${resource.getHtmlKey()}, json:${resource.getJsonKey()}`
      );

      await Promise.all([
        this.s3Service.putObject(
          resource.getHtmlKey(),
          candidatePage.getHtmlBody(),
          "text/html",
          cacheControl
        ),
        this.s3Service.putObject(
          resource.getJsonKey(),
          candidatePage.getJsonBody(),
          "application/json"
        )
      ]);

      await this.createInvalidation(resource, manifest);
      return;
    }
    debug(`[handler] Resource is not changed.}`);
    return;
  }

  //check lastModified to control revalidate
  private shouldSkipRevalidate(lastModified: Date | undefined, gap: number) {
    if (lastModified === undefined) return false;
    debug(
      `[checkRevalidateTimeGap] lastModified at ${lastModified}, current: ${new Date()}`
    );

    return new Date() < new Date(lastModified!.getTime() + gap * 1000);
  }

  /**
   * compare diffs between old s3 json files and new candidate page.
   * The page data is saved in contentfulCache and apolloState. So, we should
   * only compare this two values.
   * @param candidatePage
   * @param resource
   * @private
   */
  private async isContentChanged(
    candidatePage: Page,
    resource: Resource | ResourceForIndexPage
  ): Promise<boolean> {
    debug(`[isContentChanged] resource json key: ${resource.getJsonKey()}`);

    const oldData: S3JsonFile = JSON.parse(
      await this.s3Service.getObject(resource.getJsonKey())
    );

    const newData: S3JsonFile = candidatePage.getJson();

    const isDataChanged = !isEqual(
      omit(oldData.pageProps, "generatedAt"),
      omit(newData.pageProps, "generatedAt")
    );

    debug(
      `[isContentChanged] data compare ${JSON.stringify({ oldData, newData })}`
    );

    return isDataChanged;
  }

  /**
   * handler the invalidation logic.
   * @param resource
   * @param manifest
   * @private
   */
  private async createInvalidation(
    resource: Resource | ResourceForIndexPage,
    manifest: OriginRequestDefaultHandlerManifest
  ): Promise<void> {
    debug(
      `[createInvalidation]  createInvalidation for ${resource.getHtmlUri()}, ${resource.getJsonUri()}`
    );

    const useRemoteInvalidation = manifest.enableRemoteInvalidation;

    const env = getEnvironment(manifest);
    if (useRemoteInvalidation) {
      await this.cloudfrontService.createRemoteInvalidation(
        [resource.getHtmlUri(), resource.getJsonUri()],
        env
      );
    } else {
      await this.cloudfrontService.createInvalidation([
        resource.getHtmlUri(),
        resource.getJsonUri()
      ]);
    }
  }
}
