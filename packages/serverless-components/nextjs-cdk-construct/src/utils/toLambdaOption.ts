// @ts-nocheck
// TODO: fix line 12-14 TS errors: TS2361: The right-hand side of an 'in' expression must not be a primitive.
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
