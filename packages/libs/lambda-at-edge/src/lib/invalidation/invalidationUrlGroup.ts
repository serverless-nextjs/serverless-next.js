// @ts-ignore
import * as _ from "../lodash";
import { Resource } from "../../services/resource";
import { debug } from "../console";

export const INVALIDATION_DATA_DIR = "/_invalidation_group_data/";

// for serverless input
export type BasicInvalidationUrlGroup = {
  regex: string;
  invalidationPath: string;
  maxAccessNumber: number;
};

/**
 * currentNumber will change when use access group url.
 * But this method is not very accurate, and can only be used to
 * calculate big number (100-1000). If you need to ensure the calculation accuracy，
 * you need to use redis.
 */
export type InvalidationUrlGroup = BasicInvalidationUrlGroup & {
  currentNumber: number;
};

/**
 * get s3 data key from group
 * @param basicGroup
 * @param resource
 */
export function getGroupS3Key(
  basicGroup: BasicInvalidationUrlGroup,
  resource: Resource
): string {
  return `${(resource.getBasePath() || "").replace(/^\//, "")}${
    !resource.getBasePath() ? "" : "/"
  }_next/data/${resource.getBuildId()}${INVALIDATION_DATA_DIR}${getGroupFilename(
    basicGroup
  )}`;
}

export function getGroupFilename(
  basicGroup: BasicInvalidationUrlGroup
): string {
  const filename = `${basicGroup.invalidationPath}${basicGroup.maxAccessNumber}`.replace(
    /[^a-z0-9A-Z]/g,
    "_"
  );
  return `${filename}.json`;
}

export function replaceUrlByGroupRegex(
  group: InvalidationUrlGroup,
  url: string
): string {
  return url.replace(new RegExp(group.regex), group.invalidationPath);
}

export function findInvalidationGroup(
  url: string,
  basicGroups: BasicInvalidationUrlGroup[] | undefined
): BasicInvalidationUrlGroup | null {
  debug(`[findInvalidationGroup] url: ${url}`);

  if (_.isEmpty(basicGroups)) {
    debug(`[findInvalidationGroup] no group url`);
    return null;
  }

  let result = null;
  basicGroups?.forEach((group) => {
    debug(`[findInvalidationGroup] url match check: ${url.match(group.regex)}`);
    if (!_.isEmpty(url.match(group.regex))) {
      result = group;
    }
  });
  return result;
}
