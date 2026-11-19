/* Compatibilidad con el sistema original: no necesita Edge Functions ni migraciones.
   Usa las tablas y el bucket existentes solo cuando la persona opera la web. */
(function (root) {
  const EXTRA_KEY = 'pawid_pet_extras';
  const PROFILE = 'id, nombre, email, telefono, foto_path, proveedor';
  function create(client, options = {}) {
    const storage = options.storage || root.localStorage;
    const bucket = options.bucket || root.PawIDConfig?.bucket || 'mascotas-fotos';
    const hash = options.hash || (password => root.CryptoJS.SHA256(password).toString());
    const uuid = options.uuid || (() => root.crypto.randomUUID());
    const photoFields = ['fotos','peso_kg','vacunas','descripcion'];
    function user() {
      try { const value = JSON.parse(storage.getItem('pawid_user') || 'null'); return value?.id ? value : null; }
      catch { return null; }
    }
    function setUser(value) {
      const clean = {};
      for (const key of ['id','nombre','email','telefono','foto_path','proveedor']) if (value[key] !== undefined) clean[key] = value[key];
      storage.setItem('pawid_user', JSON.stringify(clean));
      return clean;
    }
    function requireUser() { const value = user(); if (!value) throw new Error('Inicia sesión para continuar.'); return value; }
    function extras() {
      try { const value = JSON.parse(storage.getItem(EXTRA_KEY) || '{}'); return value && !Array.isArray(value) && typeof value === 'object' ? value : {}; }
      catch { return {}; }
    }
    function merge(pet) {
      const local = extras()[pet.id] || {};
      const merged = {...pet};
      for (const key of photoFields) if (Object.hasOwn(local,key)) merged[key] = local[key];
      return merged;
    }
    function reserveExtras(id, update) {
      const all = extras(), hadPrevious = Object.hasOwn(all,id), previous = all[id];
      all[id] = {...(all[id] || {})};
      for (const key of photoFields) if (Object.hasOwn(update,key)) all[id][key] = update[key];
      try { storage.setItem(EXTRA_KEY, JSON.stringify(all)); }
      catch { throw new Error('El navegador no tiene espacio para las fotos adicionales. Quita algunas e intenta nuevamente.'); }
      const saved = JSON.stringify(all[id]);
      return () => {
        const latest = extras();
        if (JSON.stringify(latest[id]) !== saved) return;
        if (hadPrevious) latest[id] = previous; else delete latest[id];
        storage.setItem(EXTRA_KEY, JSON.stringify(latest));
      };
    }
    async function listPets() {
      const owner = requireUser();
      const {data,error} = await client.from('mascotas').select('*').eq('usuario_id',owner.id);
      if (error) throw error;
      return (data || []).map(merge);
    }
    async function savePet(id, update) {
      const owner = requireUser();
      const {data: existing,error: findError} = await client.from('mascotas').select('*').eq('id',id).eq('usuario_id',owner.id).maybeSingle();
      if (findError) throw findError;
      if (!existing) throw new Error('No puedes modificar esta mascota.');
      const payload = {};
      for (const key of ['nombre','especie','raza','fecha_nacimiento','dueno_telefono']) if (Object.hasOwn(update,key)) payload[key] = update[key];
      payload.foto_path = update.fotos[0] || '';
      // Solo escribe columnas adicionales cuando ya existen en esa mascota.
      for (const key of photoFields) if (Object.hasOwn(existing,key)) payload[key] = update[key];
      const rollback = reserveExtras(id,update);
      try {
        const {data,error} = await client.from('mascotas').update(payload).eq('id',id).eq('usuario_id',owner.id).select('id').single();
        if (error) throw error;
        if (!data) throw new Error('No fue posible guardar la mascota.');
      } catch (error) { rollback(); throw error; }
    }
    async function createPet(update) {
      const owner = requireUser();
      const numericId = () => {
        const values = new Uint16Array(1); root.crypto.getRandomValues(values);
        return String(Date.now()) + String(values[0] % 1000).padStart(3,'0');
      };
      let id = numericId(), usingUUID = false;
      for (let attempt=0; attempt<4; attempt++) {
        const payload = {id, usuario_id:owner.id, nombre:update.nombre, especie:update.especie, raza:update.raza,
          fecha_nacimiento:update.fecha_nacimiento, dueno_nombre:owner.nombre || 'Tutor', dueno_telefono:owner.telefono || '', foto_path:update.fotos[0] || ''};
        const rollback = reserveExtras(id,update);
        let result;
        try { result = await client.from('mascotas').insert([payload]).select('id').single(); }
        catch (error) { rollback(); throw error; }
        if (!result.error) return result.data;
        rollback();
        // Conserva el formato numérico original; si la columna exige UUID, usa UUID.
        if (result.error.code === '22P02' && !usingUUID) {
          id = uuid(); usingUUID = true; continue;
        }
        if (['22001','23505'].includes(result.error.code)) {
          if (result.error.code === '22001') usingUUID = false;
          id = usingUUID ? uuid() : numericId();
          continue;
        }
        throw result.error;
      }
      throw new Error('No fue posible asignar un identificador compatible. No se modificaron los registros anteriores.');
    }
    return {
      user, setUser, hasSession: () => !!user(),
      clear() { storage.removeItem('pawid_user'); },
      async login(email,password) {
        const {data,error} = await client.from('usuarios').select(PROFILE).eq('email',email.trim().toLowerCase())
          .eq('password',hash(password)).or('proveedor.eq.email,proveedor.is.null').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Correo o contraseña incorrectos.');
        return setUser(data);
      },
      listPets, savePet, createPet,
      async deletePet(id) {
        const owner = requireUser();
        const {data,error} = await client.from('mascotas').delete().eq('id',id).eq('usuario_id',owner.id).select('id').single();
        if (error) throw error;
        if (!data) throw new Error('No puedes eliminar esta mascota.');
        const all = extras(); delete all[id]; storage.setItem(EXTRA_KEY,JSON.stringify(all));
      },
      async uploadPhoto(file) {
        const owner = requireUser();
        const ext = file.name.split('.').pop().replace(/[^a-z0-9]/gi,'') || 'jpg';
        const path = owner.id + '/' + uuid() + '.' + ext;
        const target = client.storage.from(bucket);
        const {error} = await target.upload(path,file,{cacheControl:'3600',upsert:false});
        if (error) throw error;
        return target.getPublicUrl(path).data.publicUrl;
      }
    };
  }
  root.PawLegacyStore = {create};
})(window);
