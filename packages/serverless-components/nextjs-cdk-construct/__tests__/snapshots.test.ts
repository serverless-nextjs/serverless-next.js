import { SynthUtils } from "@aws-cdk/assert";
import { Stack } from "@aws-cdk/core";
import path from "path";
import { NextJSLambdaEdge } from "../src";

describe("CDK Construct Snapshots", () => {
  it("creates boilerplate next app", () => {
    const stack = new Stack();
    new NextJSLambdaEdge(stack, "Stack", {
      serverlessBuildOutDir: path.join(__dirname, "fixtures/next-boilerplate")
    });

    const synthesizedStack = SynthUtils.toCloudFormation(stack);
    expect(synthesizedStack).toMatchSnapshot();
  });
});
