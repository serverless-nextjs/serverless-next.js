import { LambdaBuilder } from "src/build";
import { CoreBuildOptions } from "@sls-next/core";
import { v4 as uuidv4 } from "uuid";
import { join } from "path";
import { LambdaBuildOptions } from "src/types";
import os from "os";

describe("Builder Tests", () => {
  let builder: LambdaBuilder;
  let outputDir: string;

  const lambdaBuildOptions: LambdaBuildOptions = {
    bucketName: "test-bucket",
    bucketRegion: "us-east-1"
  };

  beforeEach(() => {
    outputDir = join(os.tmpdir(), uuidv4());
  });

  it("builds successfully from .next with default options", async () => {
    const coreBuildOptions: CoreBuildOptions = {
      nextConfigDir: join(__dirname, "fixtures/simple-app"),
      outputDir: outputDir,
      cmd: "true", // to skip next build,
      cleanupDotNext: false
    };

    builder = new LambdaBuilder(lambdaBuildOptions, coreBuildOptions);
    await builder.build();

    // TODO: validate generated package
  });
});
