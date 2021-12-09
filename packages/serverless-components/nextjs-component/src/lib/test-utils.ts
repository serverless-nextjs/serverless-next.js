import fse from "fs-extra";
import path from "path";
import { BUILD_DIR } from "../constants";

export const cleanupFixtureDirectory =
  (fixtureDir: string) => (): Promise<void> => {
    return fse.remove(path.join(fixtureDir, BUILD_DIR));
  };
