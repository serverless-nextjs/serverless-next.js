import { toLambdaOption } from "../src/utils/toLambdaOption";

describe("CDK Utils", () => {
  it.each`
    args                                                | expectedReturn
    ${["defaultLambda", { defaultLambda: 1 }]}          | ${1}
    ${["apiLambda", { defaultLambda: 1 }]}              | ${undefined}
    ${["apiLambda", 1]}                                 | ${1}
    ${["imageLambda", { imageLambda: { foo: "bar" } }]} | ${{ foo: "bar" }}
    ${["defaultLambda"]}                                | ${undefined}
  `("toLambdaOption", ({ args: [key, option], expectedReturn }) => {
    expect(toLambdaOption(key, option)).toStrictEqual(expectedReturn);
  });
});
