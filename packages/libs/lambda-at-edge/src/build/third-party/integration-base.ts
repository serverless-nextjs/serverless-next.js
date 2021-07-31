import { join } from "path";
import fse from "fs-extra";

export abstract class ThirdPartyIntegrationBase {
  nextConfigDir: string;
  outputLambdaDir: string;

  constructor(nextConfigDir: string, outputLambdaDir: string) {
    this.nextConfigDir = nextConfigDir;
    this.outputLambdaDir = outputLambdaDir;
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
