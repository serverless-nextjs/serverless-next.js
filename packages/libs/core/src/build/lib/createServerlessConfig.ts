import fs from "fs-extra";
import path from "path";

function getCustomData(importName: string, ): string {
  return `
module.exports = function(...args) {
  let original = require('./${importName}');
  const finalConfig = {};
  if (typeof original === 'function' && original.constructor.name === 'AsyncFunction') {
    // AsyncFunctions will become promises
    original = original(...args);
  }
  if (original instanceof Promise) {
    // Special case for promises, as it's currently not supported
    // and will just error later on
    return original
      .then((originalConfig) => Object.assign(finalConfig, originalConfig));
  } else if (typeof original === 'function') {
    Object.assign(finalConfig, original(...args));
  } else if (typeof original === 'object') {
    Object.assign(finalConfig, original);
  }
  return finalConfig;
}
  `.trim();
}

function getDefaultData(): string {
  return `module.exports = { };`;
}

type CreateServerlessConfigResult = {
  restoreUserConfig: () => Promise<void>;
};

export default async function createServerlessConfig(
  workPath: string,
  entryPath: string,
): Promise<CreateServerlessConfigResult> {
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

  const configPathExists = fs.existsSync(configPath);

  // next.config.mjs - https://nextjs.org/docs/api-reference/next.config.js/introduction
  const configPathExistsEsm = fs.existsSync(configPath.replace(".js", ".mjs"));
  if (configPathExistsEsm) {
    configPath = configPath.replace(".js", ".mjs");
  }

  if (configPathExists) {
    await fs.rename(configPath, backupConfigPath);
    await fs.writeFile(configPath, getCustomData(backupConfigName, ));
  } else {
    await fs.writeFile(configPath, getDefaultData());
  }

  return {
    restoreUserConfig: async (): Promise<void> => {
      const needToRestoreUserConfig = configPathExists;
      await fs.remove(configPath);

      if (needToRestoreUserConfig) {
        await fs.rename(backupConfigPath, configPath);
      }
    }
  };
}
