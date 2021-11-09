#!/usr/bin/env node

/**
 * This script allows you to run the builder from the command line. It's useful for deployments like Terraform for CDK since it can't execute Node.js code directly.
 */

import { LambdaBuilder } from "src/build";
import yargs from "yargs";
import { CoreBuildOptions } from "@sls-next/core";
import { LambdaBuildOptions } from "src/types";

yargs(process.argv)
  .command(
    "build",
    "build and package the serverless next.js app",
    undefined,
    async (argv) => {
      const lambdaBuildOptions: LambdaBuildOptions = JSON.parse(
        <string>argv.lambdaBuildOptions
      );
      const coreBuildOptions: CoreBuildOptions = JSON.parse(
        <string>argv.coreBuildOptions
      );

      const builder = new LambdaBuilder(lambdaBuildOptions, coreBuildOptions);
      await builder.build(true);
    }
  )

  .option("lambdaBuildOptions", {
    alias: "l",
    type: "string",
    description: "Lambda build options",
    demandOption: true
  })
  .option("coreBuildOptions", {
    alias: "c",
    type: "string",
    description: "Core build options",
    demandOptions: false
  })
  .parse();
