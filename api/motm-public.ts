import { GET as overviewGET } from "../api-impl/motm/index";
import { GET as voteGET, POST as votePOST } from "../api-impl/motm/vote";
import { GET as standGET } from "../api-impl/motm/stand";
import { GET as shareGET } from "../api-impl/motm/share";
import { loadPlayers } from "../lib/player-registry";
import { getSessionWithPermission } from "../lib/server-permissions";
import { permissions } from "../lib/permissions.config";

export type PublicMotmAction = "index" | "vote" | "stand" | "share" | "players";

const actionFor = (request:Request):PublicMotmAction|null => {
  const action=new URL(request.url).searchParams.get("action");
  return action==="index"||action==="vote"||action==="stand"||action==="share"||action==="players"?action:null;
};

const notFound=()=>new Response("MOTM-actie niet gevonden.",{status:404,headers:{"Content-Type":"text/plain; charset=UTF-8","Cache-Control":"no-store"}});
const methodNotAllowed=(allow:string)=>new Response("Methode niet toegestaan.",{status:405,headers:{Allow:allow,"Content-Type":"text/plain; charset=UTF-8","Cache-Control":"no-store"}});
const allowedRosterOrigin=(request:Request)=>{const origin=request.headers.get("origin");return origin==="https://opstelling.ajaxpro.fans"?origin:""};
const playersGET=async(request:Request)=>{
  const includeContracts=new URL(request.url).searchParams.get("include")==="contracts";
  if(includeContracts&&!await getSessionWithPermission(request,permissions.membersAccess))return new Response(JSON.stringify({error:"Geen toegang tot contractgegevens."}),{status:403,headers:{"Content-Type":"application/json; charset=UTF-8","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  const rows=await loadPlayers({includeInactive:includeContracts});
  const players=includeContracts?rows:rows.map(({id,name,shirtNumber,position,imageUrl,active,updatedAt})=>({id,name,shirtNumber,position,imageUrl,active,updatedAt}));
  const origin=allowedRosterOrigin(request);
  return new Response(JSON.stringify({players,updatedAt:rows.reduce((latest,player)=>player.updatedAt>latest?player.updatedAt:latest,"")}),{headers:{"Content-Type":"application/json; charset=UTF-8","Cache-Control":includeContracts?"private, no-store":"public, max-age=60, stale-while-revalidate=300","X-Content-Type-Options":"nosniff","Vary":"Origin",...(!includeContracts&&origin?{"Access-Control-Allow-Origin":origin}:{})}});
};

export async function GET(request:Request){
  const action=actionFor(request);
  if(action==="index")return overviewGET(request);
  if(action==="vote")return voteGET(request);
  if(action==="stand")return standGET(request);
  if(action==="share")return shareGET(request);
  if(action==="players")return playersGET(request);
  return notFound();
}

export async function POST(request:Request){
  const action=actionFor(request);
  if(action==="vote")return votePOST(request);
  if(action==="index"||action==="stand"||action==="share"||action==="players")return methodNotAllowed("GET");
  return notFound();
}
