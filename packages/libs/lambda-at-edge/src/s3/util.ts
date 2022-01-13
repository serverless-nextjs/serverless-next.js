export const getPageKeys = (uri: string, buildId: string) => {
  const baseKey = uri
    .replace(/^\/$/, "index")
    .replace(/^\//, "")
    .replace(/\.(json|html)$/, "")
    .replace(/^_next\/data\/[^\/]*\//, "");
  return {
    jsonKey: `_next/data/${buildId}/${baseKey}.json`,
    htmlKey: `static-pages/${buildId}/${baseKey}.html`
  };
}