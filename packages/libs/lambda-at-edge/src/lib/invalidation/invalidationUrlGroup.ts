// @ts-ignore
import * as _ from "../lodash";
import { Resource } from "../../services/resource";

export const INVALIDATION_DATA_DIR = "/_invalidation_group_data/";

export type BasicInvalidationUrlGroup = {
  regex: string;
  invalidationPath: string;
  maxAccessNumber: number;
};

export type InvalidationUrlGroup = BasicInvalidationUrlGroup & {
  currentNumber: number;
};

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
  return url.replace(group.regex, group.invalidationPath);
}

export function findInvalidationGroup(
  url: string,
  basicGroups: BasicInvalidationUrlGroup[] | undefined
): BasicInvalidationUrlGroup | null {
  console.log("findInvalidationGroup", url);

  if (_.isEmpty(basicGroups)) {
    return null;
  }

  let result = null;
  basicGroups?.forEach((group) => {
    console.log("findInvalidationGroup", JSON.stringify(group));
    console.log(
      "url.match(group.regex)",
      JSON.stringify(url.match(group.regex))
    );
    if (!_.isEmpty(url.match(group.regex))) {
      result = group;
    }
  });
  return result;
}
