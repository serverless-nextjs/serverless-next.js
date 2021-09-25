export type ObjectResponse = {
  body: string;
  headers: any;
  statusCode: number;
};

export type StorePageOptions = {
  basePath: string;
  revalidate: any;
  html: any;
  buildId: string;
  pageData: any;
  uri: string;
};

export type TriggerStaticRegenerationOptions = {
  basePath: string;
  pageKey: string;
  eTag: any;
  lastModified: string | undefined;
  pagePath: any;
};

/**
 * Platforms should implement this interface which has all methods for retrieving from an object store,
 * storing a page or triggering static regeneration.
 */
export interface PlatformClient {
  /**
   * Whether this header should be ignored.
   * For example, some platforms such as AWS CloudFront may not allow certain headers to be added to the response.
   * @param name
   */
  isIgnoredHeader(name: string): boolean;

  /**
   * Get an object from this platform's object store.
   * This can be a page or other file.
   * @param pageKey
   */
  getObject(pageKey: string): ObjectResponse;

  /**
   * Trigger static regeneration for this page.
   * @param options
   */
  triggerStaticRegeneration(
    options: TriggerStaticRegenerationOptions
  ): Promise<{ throttle: boolean }>;

  /**
   * Store a page into the object store - both HTML and JSON data.
   * @param options
   */
  storePage(
    options: StorePageOptions
  ): Promise<{ cacheControl: string | undefined; expires: Date | undefined }>;
}
