import { GET as publicGET } from "../api-impl/jeugddossiers";
import { GET as manageGET, POST as managePOST } from "../api-impl/jeugddossiers-manage";

const isManageRoute = (request: Request) => new URL(request.url).searchParams.get("view") === "manage";

const methodNotAllowed = () => new Response("Method not allowed", {
  status: 405,
  headers: { Allow: "GET", "Content-Type": "text/plain; charset=UTF-8", "Cache-Control": "no-store" },
});

export async function GET(request: Request) {
  return isManageRoute(request) ? manageGET(request) : publicGET(request);
}

export async function POST(request: Request) {
  return isManageRoute(request) ? managePOST(request) : methodNotAllowed();
}
