// The implementation code below has been copied from vercel/packages/now-next/src/create-serverless-config.ts
// with minor modifications to strip out logic that isn't needed for the project

import fs from "fs-extra";
import path from "path";

function getDefaultData(): string {
  return `
     module.exports = { target: "serverless" }
    `;
}
function getCustomData(): string {
  return `
     module.exports = { target: "experimental-serverless-trace" }
    `;
}
//function getCustomData(importName: string, target: string): string {
//return `
//module.exports = function(...args) {
//let original = require('./${importName}');
//const finalConfig = {};
//const target = { target: '${target}' };
//if (typeof original === 'function' && original.constructor.name === 'AsyncFunction') {
//// AsyncFunctions will become promises
//original = original(...args);
//}
//if (original instanceof Promise) {
//// Special case for promises, as it's currently not supported
//// and will just error later on
//return original
//.then((orignalConfig) => Object.assign(finalConfig, orignalConfig))
//.then((config) => Object.assign(config, target));
//} else if (typeof original === 'function') {
//Object.assign(finalConfig, original(...args));
//} else if (typeof original === 'object') {
//Object.assign(finalConfig, original);
//}
//Object.assign(finalConfig, target);
//return finalConfig;
//}
//`.trim();
//}

//function getDefaultData(target: string): string {
//return `module.exports = { target: '${target}' };`;
//}

export default async function createServerlessConfig(
  workPath: string,
  entryPath: string
): Promise<void> {
  const target = "experimental-serverless-trace";

  const primaryConfigPath = path.join(entryPath, "next.config.js");
  const secondaryConfigPath = path.join(workPath, "next.config.js");
  const backupConfigName = `next.config.original.${Date.now()}.js`;

  const hasPrimaryConfig = fs.existsSync(primaryConfigPath);
  const hasSecondaryConfig = fs.existsSync(secondaryConfigPath);

  let configPath: string;
  let backupConfigPath: string;

  if (hasPrimaryConfig) {
    // Prefer primary path
    configPath = primaryConfigPath;
    backupConfigPath = path.join(entryPath, backupConfigName);
  } else if (hasSecondaryConfig) {
    // Work with secondary path (some monorepo setups)
    configPath = secondaryConfigPath;
    backupConfigPath = path.join(workPath, backupConfigName);
  } else {
    // Default to primary path for creation
    configPath = primaryConfigPath;
    backupConfigPath = path.join(entryPath, backupConfigName);
  }

  if (fs.existsSync(configPath)) {
    await fs.rename(configPath, backupConfigPath);
    await fs.writeFile(configPath, getCustomData(backupConfigName, target));
  } else {
    await fs.writeFile(configPath, getDefaultData(target));
  }
}
