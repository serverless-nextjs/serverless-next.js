import { SynthUtils } from "@aws-cdk/assert";
import { Stack } from "@aws-cdk/core";
import path from "path";
import { NextJSLambdaEdge } from "../src";

describe("CDK Construct Snapshots", () => {
  it("creates next app with no ISR page", () => {
    const stack = new Stack();
    new NextJSLambdaEdge(stack, "Stack", {
      serverlessBuildOutDir: path.join(__dirname, "fixtures/app")
    });

    const synthesizedStack = SynthUtils.toCloudFormation(stack);
    expect(synthesizedStack).toMatchSnapshot();
  });

  it("creates next app with ISR pages", () => {
    const stack = new Stack();
    new NextJSLambdaEdge(stack, "Stack", {
      serverlessBuildOutDir: path.join(__dirname, "fixtures/app-with-isr")
    });

    const synthesizedStack = SynthUtils.toCloudFormation(stack);
    expect(synthesizedStack).toMatchSnapshot();
  });
});
