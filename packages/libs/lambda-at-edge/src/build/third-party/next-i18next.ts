import fse from "fs-extra";
import { join } from "path";
import { ThirdPartyIntegrationBase } from "./integration-base";

export class NextI18nextIntegration extends ThirdPartyIntegrationBase {
  /**
   * This will copy all next-i18next files as needed to a lambda directory.
   */
  async execute(): Promise<void> {
    if (await this.isPackagePresent("next-i18next")) {
      const localeSrc = join(this.nextConfigDir, "public", "locales");
      const localeDest = join(this.outputLambdaDir, "public", "locales");

      if (await fse.pathExists(localeSrc)) {
        await fse.copy(localeSrc, localeDest, { recursive: true });
      }

      const nextI18nextConfigSrc = join(
        this.nextConfigDir,
        "next-i18next.config.js"
      );
      const nextI18nextConfigDest = join(
        this.outputLambdaDir,
        "next-i18next.config.js"
      );

      if (await fse.pathExists(nextI18nextConfigSrc)) {
        await fse.copy(nextI18nextConfigSrc, nextI18nextConfigDest);
      }
    }
  }
}
