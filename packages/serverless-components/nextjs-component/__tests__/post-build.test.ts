import NextjsComponent from "../src/component";
import { BuildOptions } from "../types";

describe("Post-build tests", () => {
  let component: NextjsComponent;
  let buildOptions: BuildOptions;

  beforeEach(async () => {
    component = new NextjsComponent();
    buildOptions = {
      cmd: "true",
      args: []
    };
  });

  it("executes post-build command successfully", async () => {
    buildOptions.postBuildCommands = ["true"];

    await component.postBuild({ build: buildOptions });
  });

  it("fails to execute post-build command", async () => {
    buildOptions.postBuildCommands = ["false"];

    await expect(
      component.postBuild({ build: buildOptions })
    ).rejects.toThrow();
  });
});
