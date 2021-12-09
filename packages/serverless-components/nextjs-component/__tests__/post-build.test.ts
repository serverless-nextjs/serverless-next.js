import NextjsComponent from "../src/component";
import { BuildOptions } from "../types";

describe("Post-build tests", () => {
  let component: NextjsComponent;
  let buildOptions: BuildOptions;

  beforeEach(() => {
    component = new NextjsComponent();
    buildOptions = {
      cmd: "true",
      args: []
    };
  });

  it("executes post-build command successfully", () => {
    buildOptions.postBuildCommands = ["true"];

    component.postBuild({ build: buildOptions });
  });

  it("fails to execute post-build command", () => {
    buildOptions.postBuildCommands = ["false"];

    expect(() => {
      component.postBuild({ build: buildOptions });
    }).toThrow();
  });
});
