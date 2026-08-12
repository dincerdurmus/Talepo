/**
 * Resolve the IYZWSv2 HMAC uri path for an HTTP request path.
 *
 * Request URL may include pagination query (?page=&count=).
 * Empirical sandbox behavior: signing the query causes auth failure (error 8);
 * signing the bare resource path succeeds.
 *
 * Default: strip `?…` unless `authorizationPath` override is provided.
 * Existing callers that pass path without query are unchanged.
 */
export function resolveIyzicoAuthorizationPath(
  requestPath: string,
  authorizationPath?: string,
): string {
  const override = authorizationPath?.trim();
  if (override) {
    return override.startsWith("/") ? override : `/${override}`;
  }
  const normalized = requestPath.startsWith("/")
    ? requestPath
    : `/${requestPath}`;
  const q = normalized.indexOf("?");
  return q >= 0 ? normalized.slice(0, q) : normalized;
}
