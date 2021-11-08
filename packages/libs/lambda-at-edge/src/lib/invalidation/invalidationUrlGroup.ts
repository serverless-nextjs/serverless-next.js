// @ts-ignore
import * as _ from "../lodash";

const DEFAULT_INIT_NUMBER = 0;
const INVALIDATION_DATA_DIR = "/invalidation-group-data/";

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
  originalKey: string
) => {
  const filename = `${originalKey
    .match(basicGroup.regex)![0]
    .replace(/[^a-zA-Z ]/g, "")}.json`;
  return originalKey.replace(
    basicGroup.regex,
    `${INVALIDATION_DATA_DIR}${filename}`
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
