import { createHmac, randomBytes } from "node:crypto";

/**
 * Official iyzico IYZWSv2 Authorization.
 * Source: https://docs.iyzico.com/en/getting-started/preliminaries/authentication/hmacsha256-auth.md
 *
 * HMACSHA256(randomKey + uri.path + request.body, secretKey)
 * Authorization: IYZWSv2 <base64("apiKey:"+apiKey+"&randomKey:"+randomKey+"&signature:"+encryptedData)>
 */
export function buildIyzicoAuthorization(input: {
  apiKey: string;
  secretKey: string;
  uriPath: string;
  body: string;
  randomKey?: string;
}): { authorization: string; randomKey: string } {
  const randomKey =
    input.randomKey ?? `${Date.now()}${randomBytes(4).toString("hex")}`;
  const path = input.uriPath.startsWith("/")
    ? input.uriPath
    : `/${input.uriPath}`;
  const payload =
    input.body.length === 0
      ? `${randomKey}${path}`
      : `${randomKey}${path}${input.body}`;
  const encryptedData = createHmac("sha256", input.secretKey)
    .update(payload)
    .digest("hex");
  const authorizationString = `apiKey:${input.apiKey}&randomKey:${randomKey}&signature:${encryptedData}`;
  const authorization = `IYZWSv2 ${Buffer.from(authorizationString, "utf8").toString("base64")}`;
  return { authorization, randomKey };
}
