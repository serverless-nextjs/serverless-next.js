#!/usr/bin/env node
import { execSync } from "child_process";

console.info("Note: running patched serverless binary.");

const args = process.argv.slice(2).join(" ");
// This executes package-local serverless which uses a patched @serverless/cli
execSync(`${__dirname}/../../node_modules/.bin/serverless ${args}`, {
  stdio: "inherit"
});
