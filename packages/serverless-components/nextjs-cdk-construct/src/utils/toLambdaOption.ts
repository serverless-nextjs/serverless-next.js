import { LambdaOption } from "../props";
import { CacheConfigKeyNames } from "./readAssetsDirectory";

export type CacheKeyDeploymentLambda = `${CacheConfigKeyNames}DeploymentLambda`;

export const toLambdaOption = <T>(
  key:
    | "defaultLambda"
    | "apiLambda"
    | "imageLambda"
    | "regenerationLambda"
    | CacheKeyDeploymentLambda,
  option?: LambdaOption<T>
): T | undefined => {
  if (
    typeof option !== "object" ||
    !(
      "defaultLambda" in option ||
      "apiLambda" in option ||
      "imageLambda" in option ||
      "regenerationLambda" in option ||
      CacheConfigKeyNames.publicFiles in option ||
      CacheConfigKeyNames.staticFiles in option ||
      CacheConfigKeyNames.staticPages in option ||
      CacheConfigKeyNames.nextData in option ||
      CacheConfigKeyNames.nextStatic in option
    )
  ) {
    return option as T | undefined;
  }

  return option[key];
};
