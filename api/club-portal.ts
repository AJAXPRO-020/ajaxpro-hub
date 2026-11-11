import { GET as clubGET } from "../api-impl/club";
import { GET as membersGET } from "../api-impl/members";
import { GET as contractsGET } from "../api-impl/contracts";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  if (view === "members-match-center") {
    url.searchParams.set("view", "match-center");
    return membersGET(new Request(url, request));
  }
  if (view === "members") return membersGET(request);
  if (view === "contracts") return contractsGET(request);
  return clubGET(request);
}
