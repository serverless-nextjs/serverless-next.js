// for https://sentry.ing.getjerry.com/organizations/sentry/projects/serverless-next/?project=56
import { Scope, TransactionContext } from "@sentry/types";
import {
  OriginRequestDefaultHandlerManifest,
  OriginRequestEvent,
  OriginResponseEvent,
  RevalidationEvent,
  RoutesManifest
} from "../../types";
import { Context } from "aws-lambda";

export const jerry_sentry_dsn =
  "https://7a4e4d068fa544c5aa9f90ea5317b392@sentry.ing.getjerry.com/56";

export const sentry_flush_timeout = 2000;

// add more custom info here
export const getSentryScopeWithExtraData = (
  scope: Scope,
  routesManifest: RoutesManifest,
  event: OriginRequestEvent | OriginResponseEvent | RevalidationEvent,
  context: Context,
  manifest: OriginRequestDefaultHandlerManifest
): Scope => {
  scope.clear();
  scope.setTag("app", routesManifest.basePath);
  scope.setExtra("event", JSON.stringify(event));
  scope.setExtra("context", JSON.stringify(context));
  scope.setExtra("manifest", JSON.stringify(manifest));
  return scope;
};
