// LinkTap Business · Panel multiempresa protegido. Cada identidad debe tener una única membresía.
// Instalar SOLO en linktap-business-private protegido por Cloudflare Access.
// Binding DB -> linktap-business-db. Este Worker NO recibe eventos públicos.
// Cloudflare Access team domain y audiencia del Worker privado verificados. Ambos son identificadores públicos, NO contraseñas.
const PUBLIC_PANEL='https://linktap.cl/business/';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
function b64url(s){s=s.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0))}
function jwtpart(s){return JSON.parse(new TextDecoder().decode(b64url(s)))}
async function verifiedEmail(req,env){
  const domain=String(env.ACCESS_TEAM_DOMAIN||'winter-resonance-0b9a.cloudflareaccess.com').replace(/^https?:\/\//,'').replace(/\/$/,'');
  if(!/^[a-z0-9.-]+\.cloudflareaccess\.com$/i.test(domain))throw Error('access_not_configured');
  const value=req.headers.get('Cf-Access-Jwt-Assertion')||'';
  const parts=value.split('.');
  if(parts.length!==3)throw Error('no_access_token');
  const h=jwtpart(parts[0]),p=jwtpart(parts[1]);
  if(h.alg!=='RS256'||typeof h.kid!=='string')throw Error('invalid_header');
  const res=await fetch('https://'+domain+'/cdn-cgi/access/certs');
  if(!res.ok)throw Error('unable_to_verify_identity');
  const jwks=await res.json();
  const jwk=(jwks.keys||[]).find(k=>k.kid===h.kid&&k.kty==='RSA');
  if(!jwk)throw Error('invalid_key');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64url(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
  const now=Math.floor(Date.now()/1000);
  if(!ok||p.iss!=='https://'+domain||!Array.isArray(p.aud)||!p.aud.includes(env.ACCESS_AUD||'af688284473c3fdb3043cd2c7f4936a2d2d5ad3ab90b15ec22c73ca6b6e35e6b')||
     typeof p.email!=='string'||!p.email.includes('@')||!Number.isFinite(p.exp)||p.exp<=now||
     !Number.isFinite(p.iat)||p.iat>now+60||(p.nbf!=null&&p.nbf>now+60)) throw Error('invalid_claims');
  return p.email.toLowerCase().trim();
}
function escapeJson(value){return JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026')}
const periods=[7,30,90];
async function dashboardData(env,companyId,companyName){
  const profiles=await env.DB.prepare('SELECT id, slug, full_name, job_title, public_url FROM lb_profiles WHERE company_id=? ORDER BY full_name').bind(companyId).all();
  const events=await env.DB.prepare(`SELECT e.profile_id,e.kind,e.recorded_at FROM lb_events e
    JOIN lb_profiles p ON p.id=e.profile_id
    WHERE p.company_id=? AND e.recorded_at>=datetime('now','-90 days')
    ORDER BY e.recorded_at DESC`).bind(companyId).all();
  const now=Date.now(),data=events.results;
  const isWithin=(x,days)=>{const t=Date.parse(x.recorded_at.replace(' ','T')+'Z');return Number.isFinite(t)&&t>=now-days*86400000&&t<=now+60000};
  const team=profiles.results.map(p=>({
    id:p.id,name:p.full_name,role:p.job_title,public_url:p.public_url,active:true,
    institutional: p.id===companyId+'-recepcion' || /recepci[oó]n|institucional|empresa/i.test(p.slug||'') || (/recepci[oó]n/i.test(p.full_name||'') && companyId==='monteverde'),
    views:periods.map(d=>data.filter(x=>x.profile_id===p.id&&x.kind==='view'&&isWithin(x,d)).length),
    clicks:periods.map(d=>data.filter(x=>x.profile_id===p.id&&x.kind!=='view'&&isWithin(x,d)).length)
  }));
  const clickTypes={};
  for(const d of periods){const n={};for(const x of data){if(x.kind!=='view'&&isWithin(x,d))n[x.kind]=(n[x.kind]||0)+1;}clickTypes[d]=n}
  const chartSeries={};
  for(const days of periods){
    const size=days===7?7:12;
    const bins=Array(size).fill(0);
    for(const x of data){if(x.kind!=='view'||!isWithin(x,days))continue;
      const ago=(now-Date.parse(x.recorded_at.replace(' ','T')+'Z'))/86400000;
      const i=Math.min(size-1,Math.max(0,size-1-Math.floor(ago/days*size)));
      bins[i]++;
    }
    chartSeries[days]=bins;
  }
  return {companyName,team,chartSeries,clickTypes};
}
function customBars(){
  return `function drawBars(){const totals=clickTypes[period]||{};const labels={whatsapp:'WhatsApp',call:'Llamadas',email:'Correos',save_contact:'Guardar contacto',other_link:'Otros enlaces'};const rows=Object.entries(labels).map(([k,name])=>({name,count:totals[k]||0}));const max=Math.max(1,...rows.map(x=>x.count));el('clickBars').replaceChildren();rows.forEach(x=>{const row=document.createElement('div');row.className='baritem';const name=document.createElement('span');name.textContent=x.name;const track=document.createElement('div');track.className='track';const fill=document.createElement('div');fill.className='fill';fill.style.width=(x.count/max*100)+'%';fill.style.background='linear-gradient(90deg,#366dda,#82a9fc)';track.append(fill);const value=document.createElement('span');value.className='val';value.textContent=fmt(x.count);row.append(name,track,value);el('clickBars').append(row)})}
function cell`;
}
async function panelHtml(env,companyId,companyName){
 const data=await dashboardData(env,companyId,companyName);
 const source=await fetch(PUBLIC_PANEL,{headers:{Accept:'text/html'},cf:{cacheTtl:0}});
 if(!source.ok)throw Error('panel_template_unavailable');
 let html=await source.text();
 if(!html.includes('const team=[')||!html.includes('const chartSeries='))throw Error('template_changed');
 html=html.replace(/const team=\[[\s\S]*?\];/, 'const team='+escapeJson(data.team)+';');
 html=html.replace(/const companyLabel='Mi empresa';[^\n]*/, 'const companyLabel='+escapeJson(data.companyName)+';');
 html=html.replace(/const chartSeries=\{[\s\S]*?\};/, 'const chartSeries='+escapeJson(data.chartSeries)+';\nconst clickTypes='+escapeJson(data.clickTypes)+';');
 html=html.replace(/function drawBars\(\)\{[\s\S]*?\}\nfunction cell/,customBars());
 html=html.replace('const values=chartSeries[period],max=Math.ceil(Math.max(...values)/10)*10;','const values=chartSeries[period],max=Math.max(10,Math.ceil(Math.max(...values)/10)*10);');
 html=html.replace('LinkTap Business — Vista previa','LinkTap Business — Estadísticas reales');
 html=html.replace('Modo demostración','Datos reales');
 html=html.replace('<span class="avatar">CE</span>','<span class="avatar">'+(data.companyName||'EM').split(/\s+/).slice(0,2).map(x=>x.charAt(0).toUpperCase()).join('')+'</span>');
 html=html.replace(/<div class="notice">[\s\S]*?<\/div>/,'<div class="notice"><span>✦</span><span><b>Estadísticas reales de tu empresa:</b> visitas y clics almacenados en Cloudflare D1. Estas cifras no son usuarios únicos ni garantizan contactos completados. Los datos anteriores al inicio de la medición no están incluidos.</span></div>');
 html=html.replace('Perfiles de la empresa · demostración','Perfiles digitales registrados');
 // La plantilla pública actual contiene una excepción para Monteverde: reemplazarla para todas las empresas.
 html=html.replace("const company=team.find(p=>p.id==='mv-recepcion'||/recepci[oó]n/i.test(p.name));",'const company=team.find(p=>p.institutional===true);');
 html=html.replace("const displayName=company?.id==='mv-recepcion'?'Clínica Dental Monteverde':companyLabel;",'const displayName=companyLabel;');
 html=html.replace("title.textContent=p.id==='mv-recepcion'?'Clínica Dental Monteverde':companyLabel;",'title.textContent=companyLabel;');
 html=html.replace('LINKTAP BUSINESS · EXPERIENCIA DEMOSTRATIVA · DISEÑADO PARA CRECER CONTIGO','LINKTAP BUSINESS · DATOS REALES · EMPRESAS');
 // Never cache an authenticated page containing customer analytics.
 return new Response(html,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'}});
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(request.method!=='GET')return json({error:'method_not_allowed'},405);
  let email;
  try{email=await verifiedEmail(request,env)}catch{return json({error:'authentication_required'},401)}
  if(!env.DB)return json({error:'database_unavailable'},503);
  try{
   const membership=await env.DB.prepare('SELECT m.company_id,c.name AS company_name FROM lb_memberships m JOIN lb_companies c ON c.id=m.company_id WHERE lower(m.email)=? LIMIT 2').bind(email).all();
   if(membership.results.length!==1)return json({error:'company_access_not_assigned'},403);
   const companyId=membership.results[0].company_id;
   const companyName=membership.results[0].company_name;
   if(url.pathname==='/'||url.pathname==='/business'||url.pathname==='/business/')
     return await panelHtml(env,companyId,companyName);
   if(url.pathname==='/api/business/dashboard'){
     return json(await dashboardData(env,companyId,companyName));
   }
   return json({error:'not_found'},404);
  }catch{return json({error:'dashboard_unavailable'},503)}
 }
};
