import { OriginRequestDefaultHandlerManifest } from "../../types";

export function debug(message: string): void {
  if (!isDevMode()) {
    return;
  }

  console.log(message);
}

export function isDevMode(): boolean {
  return process.env.DEBUGMODE === "true";
}

export const getEnvironment = (
  manifest: OriginRequestDefaultHandlerManifest
): string => {
  return manifest.canonicalHostname?.startsWith("getjerry") ? "prod" : "stage";
};
