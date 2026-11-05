// LinkTap Business · Piloto de medición para cuatro perfiles existentes de Clínica Monteverde.
// Worker aislado: no requiere login para eventos públicos; no entrega datos privados.
// No habilita aún activación/desactivación de los HTML en GitHub Pages.
const ORIGIN = 'https://linktap.cl';
const VALID_KINDS = new Set(['view','call','email','save_contact','whatsapp','other_link']);
function respond(data,status=200,origin=''){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
 if(origin)headers['Access-Control-Allow-Origin']=origin;
 return new Response(JSON.stringify(data),{status,headers});
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  const origin=request.headers.get('Origin');
  const trustedOrigin=origin===ORIGIN ? ORIGIN : '';
  if(request.method==='OPTIONS' && url.pathname==='/api/business/events'){
   if(!trustedOrigin)return respond({error:'origin_not_allowed'},403);
   return new Response(null,{status:204,headers:{
    'Access-Control-Allow-Origin':ORIGIN,
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Max-Age':'600','Vary':'Origin'
   }});
  }
  if(url.pathname==='/health' && request.method==='GET'){
   try{
    const row=await env.DB.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type='table' AND name LIKE 'lb_%'").first();
    return respond({service:'LinkTap Business API',status:'connected',database:'linktap-business-db',tables:row.total});
   }catch{return respond({status:'database_error'},503)}
  }
  if(url.pathname==='/api/business/profile-status' && request.method==='GET'){
   const slug=url.searchParams.get('slug')||'';
   if(!/^[a-z0-9-]{1,80}$/.test(slug))return respond({error:'invalid_profile'},400,trustedOrigin);
   try{
    const p=await env.DB.prepare('SELECT active FROM lb_profiles WHERE slug=?').bind(slug).first();
    return p?respond({active:p.active===1},200,trustedOrigin):respond({error:'not_found'},404,trustedOrigin);
   }catch{return respond({error:'database_error'},503,trustedOrigin)}
  }
  if(url.pathname==='/api/business/events' && request.method==='POST'){
   // Solo el sitio público LinkTap puede emitir eventos desde navegador.
   // Origin NO autentica el remitente: antes de ofrecer estadísticas comerciales
   // añadir WAF, rate limit y controles anti-bot.
   if(!trustedOrigin)return respond({error:'origin_not_allowed'},403);
   if(Number(request.headers.get('Content-Length')||0)>2048)return respond({error:'too_large'},413,trustedOrigin);
   let body;
   try{body=await request.json()}catch{return respond({error:'invalid_json'},400,trustedOrigin)}
   const {id,slug,kind}=body||{};
   if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||
      !['monteverde-alexis','monteverde-stefano','monteverde-lissette','monteverde-recepcion'].includes(slug)||!VALID_KINDS.has(kind))
     return respond({error:'invalid_event'},400,trustedOrigin);
   try{
    const profile=await env.DB.prepare('SELECT id FROM lb_profiles WHERE slug=? AND active=1').bind(slug).first();
    if(!profile)return respond({error:'profile_not_active'},404,trustedOrigin);
    const result=await env.DB.prepare('INSERT OR IGNORE INTO lb_events(id,profile_id,kind) VALUES(?,?,?)').bind(id,profile.id,kind).run();
    return respond({ok:true,stored:result.meta?.changes===1},202,trustedOrigin);
   }catch{return respond({error:'database_error'},503,trustedOrigin)}
  }
  return respond({error:'not_found'},404,trustedOrigin);
 }
};
