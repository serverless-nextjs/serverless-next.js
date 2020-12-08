import fse from "fs-extra";
import { join } from "path";

// Copy sharp node_modules to the dist directory
fse.copySync(
  join(process.cwd(), "sharp_node_modules"),
  join(process.cwd(), "dist", "sharp_node_modules")
);
