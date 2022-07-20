import { CacheKeyDeploymentLambdas, LambdaOption } from "../props";

type BaseLambdas =
  | "defaultLambda"
  | "apiLambda"
  | "imageLambda"
  | "regenerationLambda";

type CacheKeyDeploymentLambdasType = `${CacheKeyDeploymentLambdas}`;

type LambdaKeys = BaseLambdas | CacheKeyDeploymentLambdasType;

export const toLambdaOption = <T>(
  key: LambdaKeys,
  option?: LambdaOption<T>
): T | undefined => {
  if (
    typeof option !== "object" ||
    !(
      "defaultLambda" in option ||
      "apiLambda" in option ||
      "imageLambda" in option ||
      "regenerationLambda" in option ||
      CacheKeyDeploymentLambdas.publicFiles in option ||
      CacheKeyDeploymentLambdas.staticFiles in option ||
      CacheKeyDeploymentLambdas.staticPages in option ||
      CacheKeyDeploymentLambdas.nextData in option ||
      CacheKeyDeploymentLambdas.nextStatic in option
    )
  ) {
    return option as T | undefined;
  }

  return option[key];
};
