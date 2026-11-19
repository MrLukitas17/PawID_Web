/* Persistencia central en Supabase. Conserva el acceso anterior únicamente mientras
   pawid-api no está desplegada (404). Nunca guarda publicaciones nuevas localmente. */
(function(root) {
  const SESSION='pawid_server_session', PROFILE='id,nombre,email,telefono,foto_path,proveedor';
  function create(client,options={}) {
    const storage=options.storage||root.localStorage;
    const legacy=root.PawLegacyStore?.create(client,options);
    let remote=null, probing=null;
    const readUser=()=>{try{return JSON.parse(storage.getItem('pawid_user')||'null');}catch{return null;}};
    function setUser(value){const clean={};for(const key of PROFILE.split(','))if(value[key]!==undefined)clean[key]=value[key];storage.setItem('pawid_user',JSON.stringify(clean));return clean;}
    async function request(action,extra={}) {
      const token=storage.getItem(SESSION);
      const {data,error}=await client.functions.invoke('pawid-api',{body:{...extra,action},headers:token?{'x-pawid-session':token}:{}});
      if(error || !data?.ok){
        let details=data;const status=error?.context?.status||0;
        if(!details && error?.context?.json)try{details=await error.context.json();}catch{}
        const message=status===404?'Falta desplegar pawid-api en Supabase. Las publicaciones no se guardarán solo en este navegador.':details?.message||'No se pudo conectar con Supabase. Revisa la conexión y la configuración de pawid-api.';
        if(status===401 && action!=='login'){storage.removeItem(SESSION);storage.removeItem('pawid_user');}
        throw Object.assign(new Error(message),{status});
      }
      return data;
    }
    async function ready(){
      if(remote!==null)return remote;
      if(!probing)probing=request('health').then(data=>{if(data.version<3)throw new Error('Actualiza la función pawid-api con scripts/Preparar-Funciones.ps1.');remote=data.ready===true;return remote;}).catch(error=>{if(error.status===404&&!root.PawIDConfig?.requireBackend){remote=false;return false;}throw error;}).finally(()=>{probing=null;});
      return probing;
    }
    async function remoteOnly(){if(!await ready())throw new Error('Falta activar la integración en Supabase. No se guardó la publicación. Consulta CONECTAR_SUPABASE.md.');}
    async function login(email,password,provider='email'){
      if(!await ready()){if(provider==='google')throw new Error('Falta activar pawid-api.');return legacy.login(email,password);}
      const data=await request('login',{email,password,provider});storage.setItem(SESSION,data.token);return setUser(data.user);
    }
    async function ensureSession(){
      if(!await ready())return legacy.user();
      if(!storage.getItem(SESSION)){storage.removeItem('pawid_user');return null;}
      try{return setUser((await request('session')).user);}catch(error){if(error.status===401)return null;throw error;}
    }
    async function petAction(action,args,legacyCall){if(!await ready())return legacyCall();return request(action,args);}
    return {
      ready,request,setUser,user:()=>remote===true&&!storage.getItem(SESSION)?null:readUser(),
      hasSession:()=>remote===true?!!storage.getItem(SESSION):!!readUser(),ensureSession,
      async login(email,password,provider){return login(email,password,provider);},
      clear(){storage.removeItem(SESSION);storage.removeItem('pawid_user');},
      async logout(){try{if(await ready() && storage.getItem(SESSION))await request('logout');}finally{storage.removeItem(SESSION);storage.removeItem('pawid_user');}},
      async register(profile,password){
        if(await ready())return request('register',{profile,password});
        const hash=options.hash||(value=>root.CryptoJS.SHA256(value).toString());
        const {data,error:findError}=await client.from('usuarios').select('id').eq('email',profile.email).or('proveedor.eq.email,proveedor.is.null').maybeSingle();
        if(findError)throw findError;if(data)throw new Error('Ya existe una cuenta asociada a ese correo.');
        const {error}=await client.from('usuarios').insert([{...profile,password:hash(password),proveedor:'email',foto_path:''}]);if(error)throw error;
      },
      async saveProfile(profile){await remoteOnly();const token=storage.getItem(SESSION);const data=await request('save-profile',{profile});if(!token||token!==storage.getItem(SESSION))throw new Error('La sesión cambió. Inicia sesión nuevamente.');return setUser(data.user);},
      async listPets(){const result=await petAction('list-pets',{},()=>legacy.listPets());return Array.isArray(result)?result:result.items;},
      async createPet(update){const result=await petAction('create-pet',{update},()=>legacy.createPet(update));return result.pet||result;},
      async savePet(id,update){return petAction('save-pet',{id,update},()=>legacy.savePet(id,update));},
      async deletePet(id){return petAction('delete-pet',{id},()=>legacy.deletePet(id));},
      async uploadPhoto(file){
        if(!await ready())return legacy.uploadPhoto(file);
        const prepared=await request('prepare-photo-upload',{name:file.name,type:file.type,size:file.size});
        const {error}=await client.storage.from(prepared.bucket).uploadToSignedUrl(prepared.path,prepared.token,file);
        if(error)throw new Error('No se pudo subir la fotografía.');return prepared.url;
      },
      async listPublications(type){await remoteOnly();const action=type==='adoption'?'list':'list-homes';try{return (await request(action)).items;}catch(error){if(error.status===401)return (await request(action)).items;throw error;}},
      async savePublication(type,item){await remoteOnly();return (await request(type==='adoption'?'save':'save-home',{item})).item;},
      async deletePublication(type,id){await remoteOnly();return request(type==='adoption'?'delete':'delete-home',{id});},
      async changePublicationState(type,id,value){await remoteOnly();return (await request(type==='adoption'?'state':'state-home',type==='adoption'?{id,adopted:value}:{id,availability:value})).item;},
      // BPMN "Cambiar Contraseña" (igual que la app): correo registrado -> código al correo ->
      // validar código -> nueva contraseña. Lo resuelve Supabase Auth con el SMTP del proyecto.
      async recoveryStatus(){return true;},
      async recoveryEmailExists(email){const {data,error}=await client.rpc('correo_registrado',{p_email:email});if(error)throw new Error('No pudimos consultar el correo. Intenta nuevamente.');return data===true;},
      async recoveryRequest(email){const {error}=await client.auth.resetPasswordForEmail(email);if(error)throw new Error(/rate|seconds/i.test(error.message||'')?'Espera un momento antes de pedir otro código.':'No se pudo enviar el código. Intenta más tarde.');},
      async recoveryVerify(email,code){const {error}=await client.auth.verifyOtp({email,token:code,type:'recovery'});if(error)throw new Error('El código no es válido o ya venció.');},
      async recoveryReset(password){const {error}=await client.auth.updateUser({password});try{await client.auth.signOut({scope:'local'});}catch{}if(error)throw new Error(/same/i.test(error.message||'')?'La nueva contraseña debe ser distinta de la anterior.':'No se pudo cambiar la contraseña. Revisa los requisitos.');},
      async googleLogin(){await remoteOnly();const data=await request('google-login');storage.setItem(SESSION,data.token);return setUser(data.user);}
    };
  }
  root.PawStore={create};
})(window);
