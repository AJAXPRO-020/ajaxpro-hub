/** Loopback review server. Existing API permissions remain unchanged. */
import {createServer} from 'node:http';
import {readFileSync,existsSync,createReadStream} from 'node:fs';
import {parseEnv} from 'node:util';
import {resolve,extname,sep} from 'node:path';
import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';
const root=process.cwd();
if(existsSync('.env.local'))Object.assign(process.env,parseEnv(readFileSync('.env.local','utf8')));
process.env.SESSION_SECRET=randomBytes(32).toString('hex');
process.env.DISCORD_REDIRECT_URI='http://localhost:3000/api/auth/discord-callback';
process.env.PORTAL_TEAM_TOOL_ROLE_IDS='local-socials-review';
process.env.NODE_ENV='development';
const main=async()=>{
 const {GET,POST}=await import('../api/club-tools');
 const {createSessionCookie}=await import('../lib/discord-auth');
 const types:Record<string,string>={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.otf':'font/otf','.ttf':'font/ttf','.woff2':'font/woff2','.ico':'image/x-icon','.json':'application/json'};
 const server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url??'/', 'http://localhost:3000');let response:Response;
   if(url.pathname==='/'||url.pathname==='/club/tools/socials'||url.pathname==='/api/club-tools'){
    const cookie=await createSessionCookie({id:'100000000000000001',username:'Lokale staffreview',avatar:null} as any,{roles:['local-socials-review']} as any);
    const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
    headers.set('cookie',cookie.split(';')[0]);
    if(url.pathname!=='/api/club-tools'){url.pathname='/api/club-tools';url.searchParams.set('view','socials')}
    const body=['GET','HEAD'].includes(req.method??'GET')?undefined:Readable.toWeb(req) as ReadableStream<Uint8Array>;
    const request=new Request(url,{method:req.method,headers,...(body?{body,duplex:'half'}:{})} as RequestInit);
    response=req.method==='POST'?await POST(request):await GET(request);
    if(response.headers.get('Content-Type')?.startsWith('text/html'))response=new Response((await response.text()).replace('<main class="motm-main socials-shell"','<p class="page-intro">Lokale review · aparte previewdatabase · Shotstack-proefcredits</p><main class="motm-main socials-shell"'),{status:response.status,headers:response.headers});
   }else{
    const file=resolve(root,'.'+decodeURIComponent(url.pathname)),ext=extname(file);
    if(!file.startsWith(root+sep)||!types[ext]||!existsSync(file)||url.pathname.includes('/.')){res.writeHead(404);res.end('Not found');return}
    res.writeHead(200,{'Content-Type':types[ext],'Cache-Control':'no-store'});createReadStream(file).pipe(res);return;
   }
   res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body){const stream=Readable.fromWeb(response.body as any);stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res)}else res.end();
  }catch(e){console.error('Local Socials request failed',e instanceof Error?e.name:'unknown');res.writeHead(500,{'Content-Type':'text/plain'});res.end('Lokale testconfiguratie is niet compleet. Controleer de terminal.');}
 });
 server.listen(3000,'127.0.0.1',()=>console.log('Socials review: http://localhost:3000/club/tools/socials (loopback only; isolated signing key)'));
};
main().catch(e=>{console.error('Socials review failed:',e instanceof Error?e.name:'unknown');process.exitCode=1});
