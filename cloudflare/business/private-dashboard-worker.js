// LinkTap Business · API PRIVADA (no desplegada)
// Requiere Cloudflare Access delante de este Worker; rechaza todo si no hay JWT válido.
// Bindings: DB (D1), vars ACCESS_TEAM_DOMAIN, ACCESS_AUD.
// No crear rutas de publicación para este Worker hasta configurar política Access.
const ORIGIN='https://linktap.cl';
function reply(obj,status=200,origin=''){
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
  if(origin) headers['Access-Control-Allow-Origin']=origin;
  return new Response(JSON.stringify(obj),{status,headers});
}
function base64url(data){
  const normalized=data.replace(/-/g,'+').replace(/_/g,'/');
  return Uint8Array.from(atob(normalized+'='.repeat((4-normalized.length%4)%4)),c=>c.charCodeAt(0));
}
function decodeJson(part){return JSON.parse(new TextDecoder().decode(base64url(part)))}
async function identity(request,env){
  if(!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD) throw Error('access_not_configured');
  const raw=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!raw) throw Error('missing_identity');
  const parts=raw.split('.');
  if(parts.length!==3) throw Error('invalid_identity');
  const header=decodeJson(parts[0]);
  const claims=decodeJson(parts[1]);
  if(header.alg!=='RS256'||typeof header.kid!=='string') throw Error('invalid_algorithm');
  const host=String(env.ACCESS_TEAM_DOMAIN).replace(/^https?:\/\//,'').replace(/\/$/,'');
  if(!/^[a-z0-9.-]+\.cloudflareaccess\.com$/i.test(host)) throw Error('invalid_team_domain');
  const certResponse=await fetch('https://'+host+'/cdn-cgi/access/certs');
  if(!certResponse.ok)throw Error('access_certs_unavailable');
  const jwks=await certResponse.json();
  const key=(jwks.keys||[]).find(k=>k.kid===header.kid&&k.kty==='RSA');
  if(!key)throw Error('unknown_key');
  const imported=await crypto.subtle.importKey('jwk',key,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',imported,base64url(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
  const now=Math.floor(Date.now()/1000);
  if(!valid||claims.iss!=='https://'+host||!Array.isArray(claims.aud)||
     !claims.aud.includes(env.ACCESS_AUD)||!Number.isFinite(claims.exp)||
     !Number.isFinite(claims.iat)||claims.exp<=now||claims.iat>now+60||
     (claims.nbf!=null&&claims.nbf>now+60)||typeof claims.email!=='string')
     throw Error('invalid_claims');
  return claims.email.trim().toLowerCase();
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const trusted=request.headers.get('Origin')===ORIGIN?ORIGIN:'';
    if(request.method==='OPTIONS'){
      // Cloudflare Access can intercept browser preflight; configure CORS in Access before enabling cross-origin UI.
      if(!trusted)return reply({error:'forbidden'},403);
      return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Access-Control-Max-Age':'600'}});
    }
    if(request.method!=='GET')return reply({error:'method_not_allowed'},405,trusted);
    if(!env.DB)return reply({error:'unavailable'},503,trusted);
    let email;
    try {email=await identity(request,env)}
    catch {return reply({error:'authentication_required'},401,trusted)}
    // El servidor obtiene la empresa a partir del correo validado; jamás del navegador.
    const memberships=await env.DB.prepare('SELECT company_id FROM lb_memberships WHERE email=?').bind(email).all();
    if(memberships.results.length!==1)return reply({error:'company_access_not_assigned'},403,trusted);
    const companyId=memberships.results[0].company_id;
    if(url.pathname==='/api/business/dashboard'){
      const days=Number(url.searchParams.get('days')||30);
      if(![7,30,90].includes(days))return reply({error:'invalid_period'},400,trusted);
      const period='-'+days+' days';
      const profiles=await env.DB.prepare(
        'SELECT id,full_name,job_title,public_url,active FROM lb_profiles WHERE company_id=? ORDER BY full_name'
      ).bind(companyId).all();
      const counts=await env.DB.prepare(
        `SELECT e.profile_id,e.kind,COUNT(*) AS total
         FROM lb_events e JOIN lb_profiles p ON p.id=e.profile_id
         WHERE p.company_id=? AND e.recorded_at>=datetime('now',?)
         GROUP BY e.profile_id,e.kind`
      ).bind(companyId,period).all();
      const daily=await env.DB.prepare(
        `SELECT date(e.recorded_at) AS day,COUNT(*) AS views
         FROM lb_events e JOIN lb_profiles p ON p.id=e.profile_id
         WHERE p.company_id=? AND e.kind='view'
           AND e.recorded_at>=datetime('now',?)
         GROUP BY date(e.recorded_at) ORDER BY day`
      ).bind(companyId,period).all();
      return reply({company_id:companyId,days,profiles:profiles.results,events:counts.results,daily_views:daily.results,generated_at:new Date().toISOString()},200,trusted);
    }
    if(url.pathname==='/api/business/history'){
      const history=await env.DB.prepare(
        `SELECT a.profile_id,p.full_name,a.actor_email,a.previous_active,a.new_active,a.created_at
         FROM lb_audit a JOIN lb_profiles p ON p.id=a.profile_id
         WHERE a.company_id=? ORDER BY a.created_at DESC LIMIT 100`
      ).bind(companyId).all();
      return reply({history:history.results},200,trusted);
    }
    return reply({error:'not_found'},404,trusted);
  }
};
