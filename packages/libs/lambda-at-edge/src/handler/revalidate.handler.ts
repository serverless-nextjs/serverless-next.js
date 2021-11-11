import { Context } from "aws-lambda";

import {
  OriginRequestDefaultHandlerManifest,
  RevalidationEvent
} from "../../types";
import { CloudFrontService } from "../services/cloudfront.service";
import { Page, RenderService, S3JsonFile } from "../services/render.service";
import { ResourceService } from "../services/resource.service";
import { S3Service } from "../services/s3.service";
import { debug, isDevMode } from "../lib/console";
import { Resource, ResourceForIndexPage } from "../services/resource";

import {
  BasicInvalidationUrlGroup,
  findInvalidationGroup,
  getGroupS3Key,
  InvalidationUrlGroup,
  replaceUrlByGroupRegex
} from "../lib/invalidation/invalidationUrlGroup";
// @ts-ignore
import * as _ from "../lib/lodash";

// ISR needs to maintain a time gap of at least tens of seconds.
const REVALIDATE_TRIGGER_GAP_SECONDS = isDevMode() ? 1 : 300;

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
    manifest: OriginRequestDefaultHandlerManifest
  ): Promise<void> {
    const resource = this.resourceService.get(event);
    debug(JSON.stringify(resource));
    debug(JSON.stringify(event));
    debug(JSON.stringify(context));

    const [htmlHeader, jsonHeader, candidatePage] = await Promise.all([
      this.s3Service.getHeader(resource.getHtmlKey()),
      this.s3Service.getHeader(resource.getJsonKey()),
      this.renderService.getPage(resource.getPagePath(), resource.getJsonUri())
    ]);

    if (this.shouldSkipRevalidate(htmlHeader.header.LastModified)) {
      debug(
        `The last ISR was triggered ${REVALIDATE_TRIGGER_GAP_SECONDS} seconds ago, so skip this one.`
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

    if (await this.isContentChanged(candidatePage, resource)) {
      debug(
        `[handler] Resource changed, update S3 cache and invalidate. html: ${resource.getHtmlKey()}, json:${resource.getJsonKey()}`
      );

      await Promise.all([
        this.s3Service.putObject(
          resource.getHtmlKey(),
          candidatePage.getHtmlBody(),
          "text/html"
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
  private shouldSkipRevalidate(lastModified: Date | undefined) {
    if (lastModified === undefined) return false;
    debug(
      `[checkRevalidateTimeGap] lastModified at ${lastModified}, current: ${new Date()}`
    );

    return (
      new Date() <
      new Date(lastModified!.getTime() + REVALIDATE_TRIGGER_GAP_SECONDS * 1000)
    );
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

    // some pages may do not have contentful data.
    const isContentFulDataChanged =
      !_.isEmpty(oldData.pageProps?.contentfulCache) &&
      !_.isEqual(
        oldData.pageProps?.contentfulCache,
        newData.pageProps?.contentfulCache
      );

    // some pages may do not have ApolloStateData.
    const isApolloStateDataChanged =
      !_.isEmpty(oldData.pageProps?.initialApolloState) &&
      !_.isEqual(
        oldData.pageProps?.initialApolloState,
        newData.pageProps?.initialApolloState
      );

    debug(
      `[isContentChanged] old contentFul is empty : ${_.isEmpty(
        oldData.pageProps?.contentfulCache
      )}. old apolloState data is empty : ${_.isEmpty(
        oldData.pageProps?.initialApolloState
      )}`
    );
    debug(
      `[isContentChanged] contentFul is equal : ${_.isEqual(
        oldData.pageProps?.contentfulCache,
        newData.pageProps?.contentfulCache
      )}. apolloState data is equal : ${_.isEqual(
        oldData.pageProps?.initialApolloState,
        newData.pageProps?.initialApolloState
      )}. `
    );

    return isContentFulDataChanged || isApolloStateDataChanged;
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
    const basicGroup: BasicInvalidationUrlGroup | null = findInvalidationGroup(
      resource.getJsonKey(),
      manifest.invalidationUrlGroups
    );
    //
    // if this is a group url, use this
    if (basicGroup !== null) {
      debug(
        `[createInvalidation] ${JSON.stringify(
          resource
        )} find url group: ${JSON.stringify(basicGroup)}`
      );

      const groupKey = getGroupS3Key(basicGroup, resource);
      const group: InvalidationUrlGroup = JSON.parse(
        await this.s3Service.getObject(groupKey)
      );

      if (group.currentNumber < group.maxAccessNumber) {
        group.currentNumber++;
        debug(
          `[createInvalidation] need add currentNumber to ${group.currentNumber}`
        );
      } else {
        group.currentNumber = 0;
        debug(`[createInvalidation] need reset currentNumber`);

        await this.cloudfrontService.createInvalidation([
          replaceUrlByGroupRegex(group, resource.getHtmlUri()),
          replaceUrlByGroupRegex(group, resource.getJsonUri())
        ]);
      }
      debug(
        `[createInvalidation] need update to group ${JSON.stringify(group)}`
      );

      await this.s3Service.putObject(
        groupKey,
        JSON.stringify(group),
        "application/json"
      );
    } else {
      debug(`[createInvalidation] not group url, just createInvalidation}`);
      await this.cloudfrontService.createInvalidation([
        resource.getHtmlUri(),
        resource.getJsonUri()
      ]);
    }
  }
}
