// @ts-ignore
import * as _ from "../lodash";
import { Resource } from "../../services/resource";

const DEFAULT_INIT_NUMBER = 0;
export const INVALIDATION_DATA_DIR = "/invalidation-group-data/";

export type BasicInvalidationUrlGroup = {
  regex: string;
  invalidationPath: string;
  maxAccessNumber: number;
};

export type InvalidationUrlGroup = BasicInvalidationUrlGroup & {
  currentNumber: number;
};

export const getGroupS3Key = (
  basicGroup: BasicInvalidationUrlGroup,
  resource: Resource
) => {
  return `${(resource.getBasePath() || "").replace(/^\//, "")}${
    !resource.getBasePath() ? "" : "/"
  }_next/data/${resource.getBuildId()}${INVALIDATION_DATA_DIR}${getGroupFilename(
    basicGroup
  )}.json`;
};

export const getGroupFilename = (basicGroup: BasicInvalidationUrlGroup) => {
  return `${basicGroup.invalidationPath}${basicGroup.maxAccessNumber}`.replace(
    /[^a-z1-9A-Z ]/g,
    "_"
  );
};

export const basicGroupToJSON = (basicGroup: BasicInvalidationUrlGroup) => {
  console.log("basicGroupToJSON", JSON.stringify(basicGroup));
  return JSON.stringify({ ...basicGroup, currentNumber: DEFAULT_INIT_NUMBER });
};

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
