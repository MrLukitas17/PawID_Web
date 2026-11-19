// Servicio público: consulta RSS sin claves ni escrituras a Supabase.
const cache = new Map();
const themes = {all:'(mascotas OR perros OR gatos OR "bienestar animal" OR "Ley Cholito")',law:'("Ley Cholito" OR "tenencia responsable")',events:'(mascotas OR perros OR gatos) (evento OR feria OR adopción OR jornada)',health:'(mascotas OR perros OR gatos) (esterilización OR vacunación OR operativo OR bienestar)'};
module.exports = async function news(req, res) {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method !== 'GET') {res.statusCode=405; return res.end(JSON.stringify({error:'Método no permitido'}));}
  const params = new URL(req.url,'http://localhost').searchParams;
  const location = key => {const value=(params.get(key)||'').trim(); if(value.length>100 || !/^[\p{L}\p{N} .()’'-]*$/u.test(value)) throw Error('Filtro inválido'); return value;};
  try {
    const region=location('region'), commune=location('commune'), topic=params.get('topic')||'all';
    if(!Object.hasOwn(themes,topic)) {res.statusCode=400;return res.end(JSON.stringify({error:'Tema inválido'}));}
    const query=[themes[topic],'Chile',commune ? '"'+commune+'"' : region ? '"'+region.replace(/^Región (de |del )?/,'')+'"' : '', 'when:30d'].filter(Boolean).join(' ');
    const cached=cache.get(query);
    if(cached && Date.now()-cached.time<600000) return res.end(JSON.stringify(cached.data));
    const url=new URL('https://news.google.com/rss/search');
    url.search=new URLSearchParams({q:query,hl:'es-419',gl:'CL',ceid:'CL:es-419'}).toString();
    const response=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{Accept:'application/rss+xml, application/xml'}});
    if(!response.ok) throw Error('Fuente no disponible');
    const xml=await response.text();
    if(!xml.includes('<rss') || xml.length>2000000) throw Error('Respuesta inválida');
    const data={xml,updatedAt:new Date().toISOString()};
    if(cache.size>=100) cache.delete(cache.keys().next().value);
    cache.set(query,{time:Date.now(),data});res.end(JSON.stringify(data));
  } catch(error) {res.statusCode=error.message==='Filtro inválido'?400:502;res.end(JSON.stringify({error:res.statusCode===400?'Filtro inválido':'No se pudo consultar la fuente de noticias.'}));}
};