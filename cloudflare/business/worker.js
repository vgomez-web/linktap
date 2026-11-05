// LinkTap Business API — Worker aislado; NO reemplazar Worker de pedidos.
// D1 binding: DB. Secrets/vars: ACCESS_TEAM_DOMAIN (example: myteam.cloudflareaccess.com),
// ACCESS_AUD, ALLOWED_ORIGIN (https://linktap.cl), EVENT_ORIGIN (same).
const EVENT_KINDS = new Set(['view','whatsapp','call','email','save_contact','other_link']);
function json(data, status=200, origin='') {
 const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
 if(origin) headers['Access-Control-Allow-Origin']=origin;
 return new Response(JSON.stringify(data),{status,headers});
}
function base64urlBytes(input) {
 const base=input.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-input.length%4)%4);
 return Uint8Array.from(atob(base),c=>c.charCodeAt(0));
}
function decodePart(part){ return JSON.parse(new TextDecoder().decode(base64urlBytes(part))); }
async function getAccessIdentity(request,env) {
 if(!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) throw Error('access_not_configured');
 const token=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!token) throw Error('access_required');
 const parts=token.split('.');
 if(parts.length!==3) throw Error('invalid_token');
 const header=decodePart(parts[0]),claims=decodePart(parts[1]);
 if(header.alg!=='RS256'||!header.kid) throw Error('invalid_algorithm');
 const domain=String(env.ACCESS_TEAM_DOMAIN).replace(/^https?:\/\//,'').replace(/\/$/,'');
 if(!/^[a-z0-9.-]+\.cloudflareaccess\.com$/i.test(domain)) throw Error('invalid_team_domain');
 const response=await fetch('https://'+domain+'/cdn-cgi/access/certs');
 if(!response.ok) throw Error('certs_unavailable');
 const {keys=[]}=await response.json();
 const jwk=keys.find(k=>k.kid===header.kid && k.kty==='RSA');
 if(!jwk) throw Error('unknown_key');
 const cryptoKey=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',cryptoKey,base64urlBytes(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
 const now=Math.floor(Date.now()/1000);
 if(!ok||claims.iss!=='https://'+domain||!Array.isArray(claims.aud)||!claims.aud.includes(env.ACCESS_AUD)||!Number.isFinite(claims.exp)||claims.exp<=now||claims.nbf>now+60||!claims.email)throw Error('invalid_identity');
 return String(claims.email).trim().toLowerCase();
}
function originAllowed(request,env) {
 const origin=request.headers.get('Origin');
 return origin && origin===String(env.ALLOWED_ORIGIN||'https://linktap.cl');
}
async function membership(env,email) {
 return env.DB.prepare("SELECT company_id FROM lb_memberships WHERE email = ? LIMIT 2").bind(email).all();
}
export default {
 async fetch(request,env) {
  const url=new URL(request.url), path=url.pathname;
  const allow=originAllowed(request,env), origin=allow?request.headers.get('Origin'):'';
  if(request.method==='OPTIONS'){
   if(!allow)return json({error:'origin_not_allowed'},403);
   return new Response(null,{status:204,headers:{
    'Access-Control-Allow-Origin':origin,
    'Access-Control-Allow-Methods':'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Max-Age':'600','Vary':'Origin'
   }});
  }
  if(!env.DB) return json({error:'database_not_configured'},503,origin);
  if(path==='/health' && request.method==='GET') return json({ok:true,service:'LinkTap Business API'},200,origin);
  if(!allow) return json({error:'origin_not_allowed'},403);
  // Public event ingestion. Accept only pre-registered, active profiles.
  // It counts measured browser events, NOT confirmed conversations or unique people.
  if(path==='/api/business/events' && request.method==='POST') {
   if(Number(request.headers.get('Content-Length')||0)>2048)return json({error:'payload_too_large'},413,origin);
   let body;try{body=await request.json()}catch{return json({error:'invalid_json'},400,origin)}
   const {id,slug,kind}=body||{};
   if(typeof id!=='string'||! /^[a-f0-9-]{36}$/i.test(id)||
      typeof slug!=='string'||!/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)||
      !EVENT_KINDS.has(kind)) return json({error:'invalid_event'},400,origin);
   const profile=await env.DB.prepare('SELECT id FROM lb_profiles WHERE slug=? AND active=1').bind(slug).first();
   if(!profile)return json({error:'profile_not_found'},404,origin);
   await env.DB.prepare('INSERT OR IGNORE INTO lb_events(id,profile_id,kind) VALUES(?,?,?)').bind(id,profile.id,kind).run();
   return json({ok:true},202,origin);
  }
  // Public profile status endpoint; integrate with existing profile HTML ONLY after testing.
  if(path==='/api/business/profile-status' && request.method==='GET'){
   const slug=url.searchParams.get('slug')||'';
   if(!/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug))return json({error:'invalid_slug'},400,origin);
   const p=await env.DB.prepare('SELECT active FROM lb_profiles WHERE slug=?').bind(slug).first();
   if(!p)return json({error:'profile_not_found'},404,origin);
   return json({active:!!p.active},200,origin);
  }
  // Only private management endpoints below require validated Cloudflare Access identity.
  let email;
  try{email=await getAccessIdentity(request,env)}
  catch(e){return json({error:'not_authorized'},401,origin)}
  let memberships=await membership(env,email);
  if(memberships.results.length!==1) return json({error:'business_access_not_assigned'},403,origin);
  const companyId=memberships.results[0].company_id;
  if(path==='/api/business/dashboard' && request.method==='GET'){
   const days=Number(url.searchParams.get('days')||30);
   if(![7,30,90].includes(days))return json({error:'invalid_period'},400,origin);
   const profiles=await env.DB.prepare(
    'SELECT id,slug,full_name,job_title,public_url,active FROM lb_profiles WHERE company_id=? ORDER BY full_name'
   ).bind(companyId).all();
   const stats=await env.DB.prepare(
    `SELECT p.id AS profile_id, e.kind AS kind, COUNT(e.id) AS total
      FROM lb_profiles p LEFT JOIN lb_events e ON e.profile_id=p.id
      AND e.recorded_at >= datetime('now', ?)
      WHERE p.company_id=? GROUP BY p.id,e.kind`
   ).bind('-'+days+' days',companyId).all();
   const daily=await env.DB.prepare(
    `SELECT date(e.recorded_at) AS day, COUNT(*) AS views
      FROM lb_events e INNER JOIN lb_profiles p ON p.id=e.profile_id
      WHERE p.company_id=? AND e.kind='view' AND e.recorded_at >= datetime('now',?)
      GROUP BY date(e.recorded_at) ORDER BY day`
   ).bind(companyId,'-'+days+' days').all();
   return json({period_days:days,company_id:companyId,profiles:profiles.results,events:stats.results,daily_views:daily.results,generated_at:new Date().toISOString()},200,origin);
  }
  if(path==='/api/business/audit' && request.method==='GET'){
   const history=await env.DB.prepare(
    `SELECT a.id,a.profile_id,p.full_name,a.actor_email,a.previous_active,a.new_active,a.created_at
    FROM lb_audit a JOIN lb_profiles p ON p.id=a.profile_id
    WHERE a.company_id=? ORDER BY a.created_at DESC LIMIT 100`
   ).bind(companyId).all();
   return json({history:history.results},200,origin);
  }
  const match=path.match(/^\/api\/business\/profiles\/([a-z0-9-]+)\/status$/);
  if(match && request.method==='PATCH'){
   let body;try{body=await request.json()}catch{return json({error:'invalid_json'},400,origin)}
   if(typeof body?.active!=='boolean')return json({error:'invalid_status'},400,origin);
   const profile=await env.DB.prepare('SELECT active FROM lb_profiles WHERE id=? AND company_id=?').bind(match[1],companyId).first();
   if(!profile)return json({error:'profile_not_found'},404,origin);
   const newValue=body.active?1:0;
   if(profile.active===newValue)return json({ok:true,active:!!newValue,changed:false},200,origin);
   // D1 batch is atomic, audit and state always move together.
   await env.DB.batch([
    env.DB.prepare('UPDATE lb_profiles SET active=? WHERE id=? AND company_id=?').bind(newValue,match[1],companyId),
    env.DB.prepare('INSERT INTO lb_audit(id,company_id,profile_id,actor_email,previous_active,new_active) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),companyId,match[1],email,profile.active,newValue)
   ]);
   return json({ok:true,active:!!newValue,changed:true},200,origin);
  }
  return json({error:'not_found'},404,origin);
 }
};
