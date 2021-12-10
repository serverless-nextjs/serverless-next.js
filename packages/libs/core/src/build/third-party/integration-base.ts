import { join } from "path";
import fse from "fs-extra";

/**
 * This class allows one to integrate third party libraries by copying them to a specific Lambda directory.
 * Extend from this, implement the execute() method, and keep it generic enough so it can be reused across platforms.
 */
export abstract class ThirdPartyIntegrationBase {
  protected nextConfigDir: string;
  protected outputHandlerDir: string;

  public constructor(nextConfigDir: string, outputHandlerDir: string) {
    this.nextConfigDir = nextConfigDir;
    this.outputHandlerDir = outputHandlerDir;
  }

  public abstract execute(): void;

  public async isPackagePresent(name: string): Promise<boolean> {
    const packageJsonPath = join(this.nextConfigDir, "package.json");

    if (await fse.pathExists(packageJsonPath)) {
      const packageJson = await fse.readJSON(packageJsonPath);
      if (packageJson.dependencies && packageJson.dependencies[name]) {
        return true;
      }
      if (packageJson.devDependencies && packageJson.devDependencies[name]) {
        return true;
      }
    }

    return false;
  }
}
