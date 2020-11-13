/**
 * Determine domain and subdomain assuming either a string representing a domain or an array representing both a domain and subdomain.
 *
 */
const obtainDomains = (
  domains: string | string[] | undefined
): { domain?: string; subdomain?: string } => {
  if (typeof domains === "string") {
    return { domain: domains, subdomain: "www" };
  }

  // Assumes an array of size 1 or 2. If size 1, then first element is domain
  // and subdomain is hardcoded to "www" (which @sls-next/domain will "unshift" to root).
  // if size 2, then first element is subdomain, second element is domain
  if (domains instanceof Array && domains.length) {
    return {
      domain: domains.length > 1 ? domains[1] : domains[0],
      subdomain: domains.length > 1 && domains[0] ? domains[0] : "www"
    };
  }

  return { domain: undefined, subdomain: undefined };
};

export default obtainDomains;
