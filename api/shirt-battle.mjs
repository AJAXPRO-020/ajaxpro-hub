import share from '../lib/shirt-battle/share.mjs';
import result from '../lib/shirt-battle/result.mjs';
export const config={runtime:'nodejs'};
export default async function handler(req,res){const url=new URL(req.url,`https://${req.headers?.host||'localhost'}`);if(url.searchParams.get('legacy')==='1'){const token=url.searchParams.get('token');if(!/^v1\.[0-9a-z]+$/i.test(token||'')){res.statusCode=404;res.end();return}res.statusCode=308;res.setHeader('Location','/shirts/r/'+token);res.setHeader('Cache-Control','public, max-age=0, must-revalidate');res.end();return}return url.searchParams.has('format')?share(req,res):result(req,res)}
