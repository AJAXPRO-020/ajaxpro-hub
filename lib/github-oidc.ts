import { createPublicKey, verify, type JsonWebKey as NodeJsonWebKey } from "node:crypto";

const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_AUDIENCE = "ajaxpro-motm-announcement";
const GITHUB_REPOSITORY = "AJAXPRO-020/ajaxpro-hub";
const GITHUB_WORKFLOW_REF = `${GITHUB_REPOSITORY}/.github/workflows/motm-announcement.yml@refs/heads/main`;
const GITHUB_JWKS_URL = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`;

type GitHubOidcClaims = {
  aud?: unknown;
  exp?: unknown;
  iss?: unknown;
  nbf?: unknown;
  repository?: unknown;
  ref?: unknown;
  workflow_ref?: unknown;
};

type GitHubJwk = NodeJsonWebKey & { kid?: string; kty?: string };

const decodePart = <T>(value: string): T => JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;

export const validGitHubOidcClaims = (claims: GitHubOidcClaims, nowSeconds = Math.floor(Date.now() / 1000)) => {
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  return claims.iss === GITHUB_OIDC_ISSUER
    && audience.includes(GITHUB_OIDC_AUDIENCE)
    && claims.repository === GITHUB_REPOSITORY
    && claims.ref === "refs/heads/main"
    && claims.workflow_ref === GITHUB_WORKFLOW_REF
    && typeof claims.exp === "number"
    && claims.exp > nowSeconds
    && (claims.nbf === undefined || (typeof claims.nbf === "number" && claims.nbf <= nowSeconds));
};

export const verifyGitHubOidcRequest = async (request: Request) => {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;
  const token = authorization.slice(7).trim();
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const header = decodePart<{ alg?: unknown; kid?: unknown }>(parts[0]);
    const claims = decodePart<GitHubOidcClaims>(parts[1]);
    if (header.alg !== "RS256" || typeof header.kid !== "string" || !validGitHubOidcClaims(claims)) return false;
    const response = await fetch(GITHUB_JWKS_URL, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return false;
    const payload = await response.json() as { keys?: GitHubJwk[] };
    const jwk = payload.keys?.find(key => key.kid === header.kid && key.kty === "RSA");
    if (!jwk) return false;
    return verify(
      "RSA-SHA256",
      Buffer.from(`${parts[0]}.${parts[1]}`),
      createPublicKey({ key: jwk, format: "jwk" }),
      Buffer.from(parts[2], "base64url"),
    );
  } catch {
    return false;
  }
};
