import { LambdaOption } from "../props";

export const toLambdaOption = <T>(
  key: "defaultLambda" | "apiLambda" | "imageLambda" | "regenerationLambda",
  option?: LambdaOption<T>
): T | undefined => {
  if (
    typeof option !== "object" ||
    !(
      "defaultLambda" in option ||
      "apiLambda" in option ||
      "imageLambda" in option ||
      "regenerationLambda" in option
    )
  ) {
    return option as T | undefined;
  }
  return option[key];
};
