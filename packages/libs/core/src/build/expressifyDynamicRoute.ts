/**
 * Convert any dynamic route to express route of the dynamic part.
 * @param dynamicRoute
 */
const expressifyDynamicRoute = (dynamicRoute: string): string => {
  return dynamicRoute
    .replace(/\[\[\.\.\.(.*)]]$/, ":$1*")
    .replace(/\[\.\.\.(.*)]$/, ":$1*")
    .replace(/\[(.*?)]/g, ":$1");
};

export { expressifyDynamicRoute };
