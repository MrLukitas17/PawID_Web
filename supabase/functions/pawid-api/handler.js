// Núcleo sin dependencias para poder probar autorización y persistencia con un servidor simulado.
export function createHandler({ admin, appUrl, bucket = 'mascotas-fotos', cryptoImpl = crypto, now = () => Date.now() }) {
  const headers = {
    'Access-Control-Allow-Origin': new URL(appUrl).origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pawid-session',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Content-Type': 'application/json'
  };
  const digest = async value => Array.from(new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', new TextEncoder().encode(value))))
    .map(x => x.toString(16).padStart(2, '0')).join('');
  const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
  const run = async query => { const {data, error} = await query; if (error) throw error; return data; };
  const expose = row => ({id:row.id,ownerId:row.usuario_id,petId:row.mascota_id,name:row.nombre||'',description:row.descripcion||'',species:row.especie||'',size:row.tamano||'',region:row.region||'',comuna:row.comuna||'',contactPhone:row.telefono||'',contact:row.contacto||'',breed:row.raza||'',age:row.edad||'',sterilized:row.esterilizado||'',vaccines:row.vacunas||'',images:row.fotos?.length?row.fotos:(row.foto_mascota?[row.foto_mascota]:[]),image:row.foto_mascota||'',adopted:row.adoptado===true});
  const exposeHome = row => ({id:row.id,ownerId:row.usuario_id,name:row.nombre_hogar||'',description:row.descripcion||'',species:row.especie||'',size:row['tamaño']||'',region:row.region||'',comuna:row.comuna||'',contactPhone:row.telefono||'',contact:row.contacto||'',availability:row.disponibilidad===false?'No disponible':'Disponible'});
  async function allRows(query) {
    const rows = [];
    for (let start = 0; ; start += 500) {
      const page = await run(query().range(start, start + 499));
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  }
  async function sessionFor(req, required = true) {
    const token = req.headers.get('x-pawid-session') || '';
    if (!token && !required) return null;
    if (!/^[a-f0-9]{64}$/.test(token)) fail('Inicia sesión para continuar.', 401);
    const session = await run(admin.from('pawid_web_sessions').select('owner_id').eq('token_hash', await digest(token))
      .gt('expires_at', new Date(now()).toISOString()).maybeSingle());
    if (!session) fail('Tu sesión venció. Inicia sesión nuevamente.', 401);
    return session;
  }
  function images(value) {
    if (!Array.isArray(value) || value.length > 8 || value.some(url => typeof url !== 'string' ||
      !/^(https?:\/\/|data:image\/(png|jpeg|webp|gif|avif);base64,)/i.test(url))) fail('Las fotografías no son válidas.');
    return value;
  }
  const profileColumns = 'id,nombre,email,telefono,foto_path,proveedor';
  async function issueSession(user) {
    const token = Array.from(cryptoImpl.getRandomValues(new Uint8Array(32))).map(x => x.toString(16).padStart(2, '0')).join('');
    await run(admin.from('pawid_web_sessions').insert({token_hash: await digest(token), owner_id: String(user.id)}));
    return {ok: true, token, user};
  }
  async function insertCompatible(table,values,columns){return run(admin.from(table).insert({...values,id:cryptoImpl.randomUUID()}).select(columns).single());}
  async function verifiedGoogle(req) {
    const bearer=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');
    const {data,error}=await admin.auth.getUser(bearer);
    if(error || !data?.user?.email)fail('Verifica tu cuenta con Google.',401);
    const identity=data.user;
    if(!identity.app_metadata?.providers?.includes('google') && identity.app_metadata?.provider!=='google')fail('Inicia sesión con Google.',401);
    return identity;
  }
  return async req => {
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (req.method === 'OPTIONS') return new Response('ok', {headers});
    if (!['GET', 'POST'].includes(req.method)) return reply({ok: false}, 405);
    try {
      const raw = req.method === 'GET' ? '' : await req.text();
      if (raw.length > 8 * 1024 * 1024) fail('Las fotos ocupan demasiado espacio.');
      const body = req.method === 'GET' ? {action: 'health'} : JSON.parse(raw);
      if (body.action === 'health') {
        const checks = [];
        for (const [table, columns] of [
          ['usuarios', 'id,nombre,email,password,telefono,foto_path,proveedor'],
          ['mascotas', 'id,usuario_id,nombre,especie,raza,fecha_nacimiento,foto_path,fotos,peso_kg,vacunas,descripcion'],
          ['pawid_web_sessions', 'token_hash,owner_id,expires_at'],
          ['publicacion_adopcion', 'id,usuario_id,mascota_id,adoptado,fotos,nombre,descripcion,especie,tamano,telefono,contacto,region,comuna,raza,edad,esterilizado,vacunas,updated_at'],
          ['publicaciones_hogares__temporales', 'id,usuario_id,nombre_hogar,descripcion,especie,tamaño,region,comuna,telefono,contacto,disponibilidad,updated_at']
        ]) {
          const result = await admin.from(table).select(columns).limit(0);
          checks.push({component: table, ready: !result.error});
        }
        const storage = await admin.storage.getBucket(bucket);
        checks.push({component: 'bucket', ready: !storage.error && storage.data?.public === true});
        const ready = checks.every(check => check.ready);
        return reply({ok: ready, service: 'pawid-api', version: 3, ready, checks,
          message: ready ? 'PawID está preparado.' : 'La función responde, pero faltan tablas, columnas o la configuración del bucket. Revisa la guía de puesta en marcha.'}, ready ? 200 : 503);
      }
      if (body.action === 'register') {
        const profile=body.profile||{};
        if(typeof body.password!=='string' || body.password.length<6 || body.password.length>128)fail('La contraseña debe tener entre 6 y 128 caracteres.');
        const email=String(profile.email||'').trim().toLowerCase(), nombre=String(profile.nombre||'').trim(), telefono=String(profile.telefono||'');
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || !nombre || nombre.length>150 || (telefono && !/^9\d{8}$/.test(telefono)))fail('Revisa los datos de registro.');
        const existing=await run(admin.from('usuarios').select('id').eq('email',email).or('proveedor.eq.email,proveedor.is.null').maybeSingle());
        if(existing)fail('Ya existe una cuenta asociada a ese correo.',409);
        await insertCompatible('usuarios',{email,nombre,telefono,password:await digest(body.password),proveedor:'email',foto_path:''},'id');
        return reply({ok:true});
      }
      if (body.action === 'google-profile' || body.action === 'google-password') {
        const identity=await verifiedGoogle(req), email=identity.email.trim().toLowerCase();
        let user=await run(admin.from('usuarios').select(profileColumns).eq('email',email).eq('proveedor','google').maybeSingle());
        if(!user)user=await insertCompatible('usuarios',{email,nombre:String(identity.user_metadata?.full_name||identity.user_metadata?.name||email.split('@')[0]).slice(0,150),password:'GOOGLE',telefono:'',foto_path:'',proveedor:'google'},profileColumns);
        const pending=await run(admin.from('usuarios').select('id').eq('id',user.id).eq('password','GOOGLE').maybeSingle());
        if(body.action==='google-profile')return reply({ok:true,user,needsPassword:!!pending});
        if(!pending)fail('La cuenta ya tiene contraseña. Inicia sesión nuevamente.',409);
        if(typeof body.password!=='string' || body.password.length<6 || body.password.length>128)fail('La contraseña debe tener entre 6 y 128 caracteres.');
        const nombre=String(body.nombre||user.nombre).trim().slice(0,150);
        user=await run(admin.from('usuarios').update({nombre,password:await digest(body.password)}).eq('id',user.id).eq('password','GOOGLE').select(profileColumns).single());
        return reply(await issueSession(user));
      }
      if (body.action === 'login') {
        if (typeof body.email !== 'string' || typeof body.password !== 'string' || body.password.length > 128) fail('Datos de acceso inválidos.');
        const email = body.email.trim().toLowerCase();
        let query = admin.from('usuarios').select('id,nombre,email,telefono,foto_path,proveedor').eq('email', email)
          .eq('password', await digest(body.password));
        if (body.provider === 'google') {
          const identity=await verifiedGoogle(req);
          if (identity.email.toLowerCase() !== email) fail('Verifica tu cuenta de Google.', 401);
          query = query.eq('proveedor', 'google');
        } else { query = query.or('proveedor.eq.email,proveedor.is.null'); }
        const user = await run(query.maybeSingle());
        if (!user) fail('Correo o contraseña incorrectos.', 401);
        return reply(await issueSession(user));
      }
      if (body.action === 'list') {
        const session = await sessionFor(req, false);
        const available = await allRows(() => admin.from('publicacion_adopcion').select('*').eq('adoptado', false).order('id'));
        const own = session ? await allRows(() => admin.from('publicacion_adopcion').select('*').eq('usuario_id', session.owner_id).order('id')) : [];
        return reply({ok: true, items: [...new Map([...available, ...own].map(row => [row.id, expose(row)])).values()]});
      }
      if (body.action === 'list-homes') {
        const session=await sessionFor(req,false);
        const available=await allRows(()=>admin.from('publicaciones_hogares__temporales').select('*').eq('disponibilidad',true).order('id'));
        const own=session?await allRows(()=>admin.from('publicaciones_hogares__temporales').select('*').eq('usuario_id',session.owner_id).order('id')):[];
        return reply({ok:true,items:[...new Map([...available,...own].map(row=>[row.id,exposeHome(row)])).values()]});
      }
      const session = await sessionFor(req);
      if (body.action === 'list-pets') {
        const items = await allRows(() => admin.from('mascotas').select('*').eq('usuario_id', session.owner_id).order('id'));
        return reply({ok: true, items});
      }
      if (body.action === 'delete-pet') {
        const pet = await run(admin.from('mascotas').select('id').eq('id', body.id).eq('usuario_id', session.owner_id).maybeSingle());
        if (!pet) fail('No puedes eliminar esta mascota.', 403);
        const publications=await run(admin.from('publicacion_adopcion').select('id').eq('mascota_id',String(body.id)).limit(1));
        if(publications.length)fail('Elimina primero las publicaciones de adopción de esta mascota.',409);
        await run(admin.from('mascotas').delete().eq('id', body.id).eq('usuario_id', session.owner_id));
        return reply({ok: true}); // No se borran archivos ni fotos de otras publicaciones.
      }
      if (body.action === 'prepare-photo-upload') {
        const extensions = {'image/png':'png','image/jpeg':'jpg','image/jpg':'jpg','image/webp':'webp','image/gif':'gif',
          'image/avif':'avif','image/bmp':'bmp','image/heic':'heic','image/heif':'heif','image/svg+xml':'svg'};
        const ext = Object.hasOwn(extensions, body.type) ? extensions[body.type] : null;
        if (!ext || !Number.isFinite(body.size) || body.size <= 0 || body.size > 10485760) fail('Selecciona una imagen de máximo 10 MB.');
        const storage = await admin.storage.getBucket(bucket);
        if (storage.error || storage.data?.public !== true) fail('Revisa el bucket de fotografías antes de subir archivos. No se ha cambiado su privacidad.', 503);
        const path = session.owner_id + '/' + cryptoImpl.randomUUID() + '.' + ext;
        const prepared = await admin.storage.from(bucket).createSignedUploadUrl(path, {upsert: false});
        if (prepared.error) throw prepared.error;
        const url = admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
        return reply({ok: true, bucket, path, token: prepared.data.token, url});
      }
      if (body.action === 'logout') {
        await run(admin.from('pawid_web_sessions').delete().eq('token_hash', await digest(req.headers.get('x-pawid-session'))));
        return reply({ok: true});
      }
      if (body.action === 'session') {
        const user = await run(admin.from('usuarios').select('id,nombre,email,telefono,foto_path,proveedor').eq('id', session.owner_id).single());
        return reply({ok: true, user});
      }
      if(body.action==='save-profile'){
        const nombre=typeof body.profile?.nombre==='string'?body.profile.nombre.trim():'';
        let telefono=typeof body.profile?.telefono==='string'?body.profile.telefono.replace(/\D/g,''):'';
        if(telefono.length===11&&telefono.startsWith('56'))telefono=telefono.slice(2);
        if(!nombre||nombre.length>150)fail('Indica un nombre de hasta 150 caracteres.');
        if(telefono&&!/^9\d{8}$/.test(telefono))fail('El teléfono debe tener 9 dígitos y empezar con 9.');
        const update={nombre,telefono};
        if(Object.hasOwn(body.profile,'foto_path')){
          const photo=body.profile.foto_path;
          if(typeof photo!=='string')fail('La foto de perfil no es válida.');
          if(photo){
            const prefix=admin.storage.from(bucket).getPublicUrl(session.owner_id+'/').data.publicUrl;
            let normalized;try{normalized=new URL(photo).href;}catch{fail('La foto de perfil no es válida.');}
            if(!normalized.startsWith(prefix)||!/^https?:/.test(normalized)||!/[.](png|jpe?g|webp)$/i.test(normalized))fail('Sube la foto desde tu cuenta antes de guardarla.');
          }
          update.foto_path=photo;
        }
        const user=await run(admin.from('usuarios').update(update).eq('id',session.owner_id).select(profileColumns).single());
        return reply({ok:true,user});
      }
      if (body.action === 'save-pet' || body.action === 'create-pet') {
        if (body.action === 'save-pet') {
          const pet = await run(admin.from('mascotas').select('id').eq('id', body.id).eq('usuario_id', session.owner_id).maybeSingle());
          if (!pet) fail('No puedes modificar esta mascota.', 403);
        }
        const update = {};
        for (const key of ['nombre','especie','raza','fecha_nacimiento','dueno_telefono','peso_kg','vacunas','descripcion']) {
          if (Object.hasOwn(body.update || {}, key)) update[key] = body.update[key];
        }
        if(Object.hasOwn(update,'fecha_nacimiento'))update.fecha_nacimiento=update.fecha_nacimiento||'';
        update.fotos = images(body.update.fotos); update.foto_path = update.fotos[0] || '';
        if (!String(update.nombre || '').trim()) fail('Indica el nombre de la mascota.');
        let pet;
        if (body.action === 'create-pet') {
          const owner = await run(admin.from('usuarios').select('nombre,telefono').eq('id', session.owner_id).single());
          pet = await insertCompatible('mascotas',{...update,usuario_id:session.owner_id,dueno_nombre:owner.nombre||'Tutor',dueno_telefono:owner.telefono||''},'id');
        } else {
          pet = await run(admin.from('mascotas').update(update).eq('id', body.id).eq('usuario_id', session.owner_id).select('id').single());
        }
        return reply({ok: true, pet});
      }
      if (['save-home','state-home','delete-home'].includes(body.action)) {
        const id=body.id||body.item?.id;
        if(typeof id!=='string' || !id || id.length>120)fail('Publicación inválida.');
        const existing=await run(admin.from('publicaciones_hogares__temporales').select('*').eq('id',id).maybeSingle());
        if(existing && existing.usuario_id!==session.owner_id)fail('Solo el propietario puede modificar el hogar.',403);
        if(body.action!=='save-home' && !existing)fail('Hogar no encontrado.',404);
        if(body.action==='delete-home'){
          await run(admin.from('publicaciones_hogares__temporales').delete().eq('id',id).eq('usuario_id',session.owner_id));
          return reply({ok:true});
        }
        const availability=body.action==='state-home'?body.availability:body.item.availability;
        if(!['Disponible','No disponible'].includes(availability))fail('Disponibilidad inválida.');
        const values={disponibilidad:availability==='Disponible',updated_at:new Date(now()).toISOString()};
        if(body.action==='save-home'){
          const payload={};
          for(const key of ['name','description','species','size','region','comuna','contactPhone','contact'])payload[key]=String(body.item[key]||'').slice(0,key==='description'?5000:500);
          if(!payload.name.trim())fail('Indica el nombre del hogar.');
          Object.assign(values,{nombre_hogar:payload.name,descripcion:payload.description,especie:payload.species,'tamaño':payload.size,region:payload.region,comuna:payload.comuna,telefono:payload.contactPhone,contacto:payload.contact});
        }
        const row=existing?await run(admin.from('publicaciones_hogares__temporales').update(values).eq('id',id).eq('usuario_id',session.owner_id).select('*').single()):await run(admin.from('publicaciones_hogares__temporales').insert({...values,id,usuario_id:session.owner_id}).select('*').single());
        return reply({ok:true,item:exposeHome(row)});
      }
      const id = body.id || body.item?.id;
      if (typeof id !== 'string' || !id || id.length > 120) fail('Publicación inválida.');
      const existing = await run(admin.from('publicacion_adopcion').select('*').eq('id', id).maybeSingle());
      if (existing && existing.usuario_id !== session.owner_id) fail('Solo el propietario puede modificar la publicación.', 403);
      if (body.action === 'state') {
        if (!existing) fail('Publicación no encontrada.', 404);
        if (typeof body.adopted !== 'boolean') fail('Estado inválido.');
        const row = await run(admin.from('publicacion_adopcion').update({adoptado: body.adopted, updated_at: new Date(now()).toISOString()})
          .eq('id', id).eq('usuario_id', session.owner_id).select('*').single());
        return reply({ok: true, item: expose(row)});
      }
      if (body.action === 'delete') {
        if (!existing) fail('Publicación no encontrada.', 404);
        await run(admin.from('publicacion_adopcion').delete().eq('id', id).eq('usuario_id', session.owner_id));
        return reply({ok: true});
      }
      if (body.action !== 'save') fail('Acción inválida.');
      const item = body.item;
      const pet = await run(admin.from('mascotas').select('id').eq('id', item.petId).eq('usuario_id', session.owner_id).maybeSingle());
      if (!pet) fail('La mascota debe pertenecer a tu cuenta.', 403);
      const payload = {};
      for (const key of ['name','description','species','size','region','comuna','contactPhone','contact','breed','age','sterilized','vaccines']) {
        payload[key] = String(item[key] || '').slice(0, key === 'description' ? 5000 : 500);
      }
      if (!payload.name.trim()) fail('Indica el nombre de la mascota.');
      payload.images = images(item.images ?? (item.image ? [item.image] : []));
      payload.image = payload.images[0] || '';
      const values={mascota_id:pet.id,nombre:payload.name,descripcion:payload.description,especie:payload.species,tamano:payload.size,region:payload.region,comuna:payload.comuna,telefono:payload.contactPhone,contacto:payload.contact,raza:payload.breed,edad:payload.age,esterilizado:payload.sterilized,vacunas:payload.vaccines,fotos:payload.images,foto_mascota:payload.image,updated_at:new Date(now()).toISOString()};
      const row = existing
        ? await run(admin.from('publicacion_adopcion').update(values).eq('id', id).eq('usuario_id', session.owner_id).select('*').single())
        : await run(admin.from('publicacion_adopcion').insert({...values,id,usuario_id:session.owner_id,adoptado:item.adopted===true}).select('*').single());
      return reply({ok: true, item: expose(row)});
    } catch (error) {
      if(error.code==='23505')return reply({ok:false,message:'Ya existe un registro con estos datos.'},409);
      return reply({ok: false, message: error.status ? error.message : 'No fue posible guardar o consultar los datos.'}, error.status || 503);
    }
  };
}
