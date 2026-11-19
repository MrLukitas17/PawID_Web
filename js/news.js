(() => {
  const form=document.getElementById('news-filters'); if(!form) return;
  const region=document.getElementById('news-region'), commune=document.getElementById('news-commune'), topic=document.getElementById('news-topic');
  const results=document.getElementById('news-results'), status=document.getElementById('news-status');
  const locations=typeof CHILE_LOCATIONS==='object'?CHILE_LOCATIONS:{};
  const options=(select,values,label)=>{select.replaceChildren(new Option(label,''),...values.map(value=>new Option(value,value)));};
  options(region,Object.keys(locations),'Todo Chile');
  function communes(){options(commune,[...new Set(region.value?(locations[region.value]||[]):Object.values(locations).flat())].sort((a,b)=>a.localeCompare(b,'es')),'Todas las comunas');}
  communes();region.addEventListener('change',communes);
  let controller,requestId=0;
  function empty(title,message){const box=document.createElement('div');box.className='news-empty';const h=document.createElement('h3'),p=document.createElement('p');h.textContent=title;p.textContent=message;box.append(h,p);results.replaceChildren(box);}
  async function load(){
    controller?.abort();controller=new AbortController();const current=controller,id=++requestId;
    status.textContent='Buscando publicaciones recientes…';results.replaceChildren();results.setAttribute('aria-busy','true');
    const timeout=setTimeout(()=>current.abort(),15000);
    try {
      const query=new URLSearchParams({region:region.value,commune:commune.value,topic:topic.value});
      const response=await fetch('/api/news?'+query,{signal:current.signal});
      if(!response.ok) throw Error('Fuente no disponible');
      const data=await response.json();const doc=new DOMParser().parseFromString(data.xml,'text/xml');
      if(doc.querySelector('parsererror') || !doc.querySelector('rss')) throw Error('RSS inválido');
      if(id!==requestId) return;
      const seen=new Set(),now=Date.now();
      const items=[...doc.querySelectorAll('item')].map(item=>({title:item.querySelector('title')?.textContent||'',url:item.querySelector('link')?.textContent||'',source:item.querySelector('source')?.textContent||'Medio original',date:new Date(item.querySelector('pubDate')?.textContent||'')})).filter(item=>{
        let url;try{url=new URL(item.url);}catch{return false;}
        if(url.protocol!=='https:' || !item.title || !Number.isFinite(item.date.getTime()) || item.date.getTime()>now || item.date.getTime()<now-30*86400000 || seen.has(item.url)) return false;
        seen.add(item.url);return true;
      }).sort((a,b)=>b.date-a.date).slice(0,12);
      for(const item of items){
        const card=document.createElement('article');card.className='news-card';
        const source=document.createElement('p');source.className='news-source';source.textContent=item.source;
        const heading=document.createElement('h3');heading.textContent=item.title;
        const date=document.createElement('time');date.dateTime=item.date.toISOString();date.textContent=item.date.toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'});
        const link=document.createElement('a');link.className='news-read';link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Leer en el medio ↗';link.setAttribute('aria-label','Leer '+item.title+' (abre otra pestaña)');
        card.append(source,heading,date,link);results.append(card);
      }
      const updated=new Date(data.updatedAt);
      status.textContent=items.length+' publicaciones · '+(commune.value||region.value||'Todo Chile')+(Number.isFinite(updated.getTime())?' · Consulta: '+updated.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}):'');
      if(!items.length) empty('Sin noticias recientes para estos filtros','Prueba otra comuna, selecciona toda la región o cambia el tema.');
    } catch(error){if(id!==requestId)return;status.textContent='Noticias no disponibles por el momento';empty('No pudimos cargar las noticias','Intenta actualizar en unos minutos. Si estás usando Live Server, inicia el servidor indicado en NOTICIAS.md.');}
    finally {clearTimeout(timeout);if(id===requestId)results.setAttribute('aria-busy','false');}
  }
  form.addEventListener('submit',event=>{event.preventDefault();load();});
  form.addEventListener('reset',()=>setTimeout(()=>{communes();load();},0));
  document.getElementById('news-refresh').addEventListener('click',load);load();
})();