import {
  createReturnToCookie,
  createDiscordAuthorization,
  getDiscordRedirectOrigin,
  noStoreHeaders,
  redirect,
  safeClubReturnTo,
} from "../../lib/discord-auth";

export async function GET(request: Request) {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: noStoreHeaders });
  }

  try {
    const requestUrl = new URL(request.url);
    const userAgent = request.headers.get("user-agent") ?? "";
    const embeddedBrowser = /Discord|FBAN|FBAV|Instagram|Line\//i.test(userAgent) && requestUrl.searchParams.get("browser") !== "1";
    if (embeddedBrowser) {
      const browserUrl = new URL(requestUrl);
      browserUrl.searchParams.set("browser", "1");
      const escapedUrl = browserUrl.toString().replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      return new Response(`<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Inloggen bij AjaxPro</title><style>body{margin:0;padding:32px;background:#08090d;color:#f6f7f9;font:16px/1.5 system-ui,sans-serif}main{max-width:520px;margin:10vh auto;padding:28px;border:1px solid #2a303a;border-radius:18px;background:#11141a}h1{font-size:2rem;line-height:1.1}p{color:#a5acb8}.button{display:flex;min-height:48px;align-items:center;justify-content:center;margin-top:14px;border-radius:10px;background:#d5122d;color:#fff;text-decoration:none;font-weight:800}.button.secondary{background:#171b23;border:1px solid #2a303a}</style></head><body><main><h1>Inloggen bij AjaxPro</h1><p>Discord heeft deze link in een ingebouwde browser geopend. Je kunt doorgaan naar Discord of AjaxPro openen in je normale browser.</p><a class="button" href="${escapedUrl}">Doorgaan naar Discord</a><a class="button secondary" href="${escapedUrl}" target="_blank" rel="noopener">Openen in browser</a></main></body></html>`, { headers: { ...noStoreHeaders, "Content-Type": "text/html; charset=UTF-8" } });
    }
    const requestOrigin = requestUrl.origin;
    const redirectOrigin = getDiscordRedirectOrigin();
    if (requestOrigin !== redirectOrigin) {
      return redirect(`${redirectOrigin}${safeClubReturnTo(requestUrl.searchParams.get("returnTo"))}`);
    }

    const authorization = createDiscordAuthorization();
    return redirect(authorization.url, {
      "Set-Cookie": [authorization.stateCookie, createReturnToCookie(requestUrl.searchParams.get("returnTo"))],
    });
  } catch (error) {
    console.error("Discord login could not be started", error);
    return redirect("/geen-toegang?reden=configuratie");
  }
}
