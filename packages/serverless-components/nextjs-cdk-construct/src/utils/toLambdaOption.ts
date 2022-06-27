import { CacheConfigKeyNames } from "./readAssetsDirectory";

export type CacheKeyDeploymentLambdas =
  `${CacheConfigKeyNames}DeploymentLambda`;
type BaseLambdas =
  | "defaultLambda"
  | "apiLambda"
  | "imageLambda"
  | "regenerationLambda";
type LambdaKeys = BaseLambdas | CacheKeyDeploymentLambdas;
export type LambdaOptions<T, LambdaKeys extends string> = {
  [Key in LambdaKeys]?: T;
};

export const toLambdaOption = <T>(
  key: LambdaKeys,
  option?: LambdaOptions<T, LambdaKeys>
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
