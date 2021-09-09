#!/usr/bin/env node
import { execSync } from "child_process";

// This executes package-local serverless which uses a patched @serverless/cli
execSync(`${__dirname}/../../node_modules/.bin/serverless`, {
  stdio: "inherit"
});
