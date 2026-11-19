import { GET as clubGET } from "../api-impl/club";
import { GET as membersGET } from "../api-impl/members";
import { GET as contractsGET } from "../api-impl/contracts";
import { DiscordRoleCheckUnavailable } from "../lib/server-permissions";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const view = url.searchParams.get("view");
    if (view === "members-match-center") {
      url.searchParams.set("view", "match-center");
      return await membersGET(new Request(url, request));
    }
    if (view === "members") return await membersGET(request);
    if (view === "contracts") return await contractsGET(request);
    return await clubGET(request);
  } catch (error) {
    if (!(error instanceof DiscordRoleCheckUnavailable)) throw error;
    return new Response("Discord is tijdelijk niet bereikbaar. Probeer het later opnieuw; je sessie blijft bewaard.", { status: 503, headers: { "Content-Type": "text/plain; charset=UTF-8", "Cache-Control": "private, no-store" } });
  }
}
