import { normalise } from "./basepath";
import { dropLocaleFromPath } from "./locale";
import { matchDynamic } from "../match";
import { getRewritePath, isExternalRewrite } from "./rewrite";
import { ApiManifest, ApiRoute, ExternalRoute, RoutesManifest } from "../types";

export const handleApiReq = (
  uri: string,
  manifest: ApiManifest,
  routesManifest: RoutesManifest,
  isRewrite?: boolean
): ExternalRoute | ApiRoute | undefined => {
  const { apis } = manifest;
  const normalisedUri = normalise(uri, routesManifest);

  const nonDynamic = apis.nonDynamic[normalisedUri];
  if (nonDynamic) {
    return {
      isApi: true,
      page: nonDynamic
    };
  }

  const rewrite = !isRewrite && getRewritePath(uri, routesManifest);
  if (rewrite) {
    // Rewrites include locales even for api routes
    const apiRewrite = dropLocaleFromPath(rewrite, routesManifest);
    const [path, querystring] = apiRewrite.split("?");
    if (isExternalRewrite(path)) {
      return {
        isExternal: true,
        path,
        querystring
      };
    }
    const route = handleApiReq(path, manifest, routesManifest, true);
    if (route) {
      return {
        ...route,
        querystring
      };
    }
    return route;
  }

  const dynamic = matchDynamic(normalisedUri, apis.dynamic);
  if (dynamic) {
    return {
      isApi: true,
      page: dynamic
    };
  }
};
