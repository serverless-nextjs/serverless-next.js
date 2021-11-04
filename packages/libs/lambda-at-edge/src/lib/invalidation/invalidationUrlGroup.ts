import isEmpty from "lodash/isEmpty";

const DEFAULT_INIT_NUMBER = 0;

export type BasicInvalidationUrlGroup = {
  regex: string;
  invalidationPath: string;
  maxAccessNumber: number;
};

export type InvalidationUrlGroup = BasicInvalidationUrlGroup & {
  currentNumber: number;
};

export const getGroupS3Key = (basicGroup: BasicInvalidationUrlGroup) => {
  return "counter";
};

export const basicGroupToJSON = (basicGroup: BasicInvalidationUrlGroup) => {
  return JSON.stringify({ ...basicGroup, currentNumber: DEFAULT_INIT_NUMBER });
};

export function findInvalidationGroup(
  url: string,
  basicGroups: BasicInvalidationUrlGroup[] | undefined
): BasicInvalidationUrlGroup | null {
  if (isEmpty(basicGroups)) {
    return null;
  }

  basicGroups?.forEach((group) => {
    if (new RegExp(group.regex).test(url)) {
      return group;
    }
  });

  return null;
}
