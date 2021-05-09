import { normalise } from "./basepath";
import { matchDynamic } from "./match";
import { getRewritePath, isExternalRewrite } from "./rewrite";
import { ApiRoute, ExternalRoute, Manifest, RoutesManifest } from "./types";

export const handleApiReq = (
  uri: string,
  manifest: Manifest,
  routesManifest: RoutesManifest,
  isRewrite?: boolean
): ExternalRoute | ApiRoute | undefined => {
  const { apis } = manifest;
  if (!apis) {
    return;
  }
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
    const [path, querystring] = rewrite.split("?");
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

  const dynamic = matchDynamic(normalisedUri, Object.values(apis.dynamic));
  if (dynamic) {
    return {
      isApi: true,
      page: dynamic
    };
  }
};
