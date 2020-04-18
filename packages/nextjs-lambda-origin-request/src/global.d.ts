import type { NextLambdaOriginRequestManifest } from "./index";

declare module "*.json" {
  const value: NextLambdaOriginRequestManifest;
  export default value;
}
