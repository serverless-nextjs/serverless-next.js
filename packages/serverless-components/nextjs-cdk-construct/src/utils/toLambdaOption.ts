import { LambdaOption } from "../props";

export const toLambdaOption = <T extends unknown>(
  key: "defaultLambda" | "apiLambda" | "imageLambda",
  option?: LambdaOption<T>
): T | undefined => {
  if (
    typeof option !== "object" ||
    !(
      "defaultLambda" in option ||
      "apiLambda" in option ||
      "imageLambda" in option
    )
  ) {
    return option as T | undefined;
  }
  return option[key];
};
