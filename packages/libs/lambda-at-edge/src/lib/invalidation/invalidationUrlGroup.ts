// @ts-ignore
import * as _ from "../lodash";
import { Resource } from "../../services/resource";

export const INVALIDATION_DATA_DIR = "/_invalidation_group_data/";

export class BasicInvalidationUrlGroup {
  readonly regex: string;

  readonly invalidationPath: string;

  readonly maxAccessNumber: number;

  constructor(
    regex: string,
    invalidationPath: string,
    maxAccessNumber: number
  ) {
    this.maxAccessNumber = maxAccessNumber;
    this.invalidationPath = invalidationPath;
    this.regex = regex;
  }

  public getGroupS3Key(resource: Resource): string {
    return `${(resource.getBasePath() || "").replace(/^\//, "")}${
      !resource.getBasePath() ? "" : "/"
    }_next/data/${resource.getBuildId()}${INVALIDATION_DATA_DIR}${this.getGroupFilename()}`;
  }

  public getGroupFilename(): string {
    const filename = `${this.invalidationPath}${this.maxAccessNumber}`.replace(
      /[^a-z0-9A-Z]/g,
      "_"
    );
    return `${filename}.json`;
  }

  public replaceUrlByGroupRegex(url: string): string {
    return url.replace(this.regex, this.invalidationPath);
  }
}

export class InvalidationUrlGroup extends BasicInvalidationUrlGroup {
  currentNumber: number;

  constructor(
    regex: string,
    invalidationPath: string,
    maxAccessNumber: number,
    currentNumber: number
  ) {
    super(regex, invalidationPath, maxAccessNumber);
    this.currentNumber = currentNumber;
  }

  public needInvalidationGroup = () => {
    return this.currentNumber >= this.maxAccessNumber;
  };

  public inc(): void {
    this.currentNumber++;
  }

  public reset(): void {
    this.currentNumber = 0;
  }

  static parse(json: string) {
    const data: {
      regex: string;
      invalidationPath: string;
      maxAccessNumber: number;
      currentNumber: number;
    } = JSON.parse(json);
    return new InvalidationUrlGroup(
      data.regex,
      data.invalidationPath,
      data.maxAccessNumber,
      data.currentNumber
    );
  }
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
