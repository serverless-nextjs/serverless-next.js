// converts a nextjs dynamic route /[param]/ -> /:param
// also handles catch all routes /[...param]/ -> /:param*
// and dynamic part of optional catch all routes /[[...param]/ -> /:param*

const expressifyDynamicRoute = (dynamicRoute: string): string => {
  // replace any catch all group first
  const expressified = dynamicRoute.replace(/\[\.\.\.(.*)]$/, ":$1*");

  // now replace other dynamic route groups
  return expressified.replace(/\[(.*?)]/g, ":$1");
};

/**
 * Convert optional catch-all route to express route of the dynamic part.
 * @param dynamicRoute
 */
const expressifyOptionalCatchAllDynamicRoute = (
  dynamicRoute: string
): string => {
  // replace any optional catch all group first
  const expressified = dynamicRoute.replace(/\[\[\.\.\.(.*)]]$/, ":$1*");

  // now replace other dynamic route groups
  return expressified.replace(/\[(.*?)]/g, ":$1");
};

export { expressifyDynamicRoute, expressifyOptionalCatchAllDynamicRoute };
