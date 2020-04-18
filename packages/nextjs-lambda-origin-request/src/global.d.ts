import { NextLambdaOriginRequestManifest } from "./types";

declare module "*.json" {
  const value: NextLambdaOriginRequestManifest;
  export default value;
}
