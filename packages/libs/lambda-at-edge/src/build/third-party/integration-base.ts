import { join } from "path";
import fse from "fs-extra";

/**
 * This class allows one to integrate third party libraries by copying them to a specific Lambda directory.
 * Extend from this, implement the execute() method, and keep it generic enough so it can be reused across platforms.
 */
export abstract class ThirdPartyIntegrationBase {
  nextConfigDir: string;
  outputHandlerDir: string;

  constructor(nextConfigDir: string, outputHandlerDir: string) {
    this.nextConfigDir = nextConfigDir;
    this.outputHandlerDir = outputHandlerDir;
  }

  abstract execute(): void;

  async isPackagePresent(name: string): Promise<boolean> {
    const packageJsonPath = join(this.nextConfigDir, "package.json");

    if (await fse.pathExists(packageJsonPath)) {
      const packageJson = await fse.readJSON(packageJsonPath);
      return !!packageJson.dependencies[name];
    }

    return false;
  }
}
