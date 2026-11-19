/* Prueba REAL y explícita: solo crea registros temporales de prueba.
   No usa credenciales existentes. No ejecutar como parte de pruebas unitarias. */
if(!process.argv.includes('--confirm-live-test')){console.log('Prueba real deshabilitada. Requiere --confirm-live-test y limpieza de cuentas temporales.');process.exit(0);}
const fs=require('node:fs'),crypto=require('node:crypto');
const config=fs.readFileSync(require('node:path').join(__dirname,'../js/config.js'),'utf8');
const base=/supabaseUrl:\s*'([^']+)'/.exec(config)[1],key=/publishableKey:\s*'([^']+)'/.exec(config)[1];
const created={users:[],pets:[],adoptions:[],homes:[],photos:[]};
const checks=[];const check=(value,label)=>{if(!value)throw new Error(label);checks.push(label);};
async function call(body,token){
 const response=await fetch(base+'/functions/v1/pawid-api',{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(token?{'x-pawid-session':token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const data=await response.json();return {status:response.status,...data};
}
async function run(){
 const health=await call({action:'health'});check(health.ok&&health.ready&&health.version===3,'Servicio real listo: seis componentes');
 for(let i=0;i<2;i++){
  const email='pawid-smoke-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomBytes(24).toString('hex');
  const registered=await call({action:'register',profile:{nombre:'Prueba temporal PawID',email,telefono:''},password});
  check(registered.ok,'Registro temporal '+i);
  const login=await call({action:'login',email,password});
  if(!login.ok)throw new Error('No se pudo iniciar cuenta temporal '+i);
  created.users.push({id:login.user.id,email,token:login.token});
  check(!login.user.password&&/^[a-f0-9]{64}$/.test(login.token),'Acceso sin exponer contraseña '+i);
 }
 const owner=created.users[0],other=created.users[1];
 const prepared=await call({action:'prepare-photo-upload',type:'image/png',size:68},owner.token);
 check(prepared.ok&&prepared.path.startsWith(owner.id+'/'),'Autorización de foto ligada al propietario');
 const photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQ0AAAAASUVORK5CYII=','base64');
 const uploaded=await fetch(base+'/storage/v1/object/upload/sign/'+prepared.bucket+'/'+prepared.path+'?token='+encodeURIComponent(prepared.token),{method:'PUT',headers:{'Content-Type':'image/png','x-upsert':'false'},body:photo});
 check(uploaded.ok,'Fotografía temporal guardada en Storage');created.photos.push(prepared.path);
 const pet=await call({action:'create-pet',update:{nombre:'Prueba temporal PawID',especie:'Gato',raza:'Mestizo',fecha_nacimiento:null,peso_kg:3.5,vacunas:'Sí',descripcion:'Registro exclusivo para verificar la integración.',fotos:[prepared.url]}},owner.token);
 check(pet.ok,'Mascota guardada con fecha vacía y antecedentes');created.pets.push(pet.pet.id);
 const id=pet.pet.id;
 let fresh=await call({action:'list-pets'},owner.token);check(fresh.items.some(p=>p.id===id&&Number(p.peso_kg)===3.5&&p.fotos[0]===prepared.url),'Recarga recupera foto, peso y vacunas de la base');
 const changed=await call({action:'save-pet',id,update:{nombre:'Prueba temporal editada',fotos:[prepared.url],descripcion:'Edición confirmada'}},owner.token);check(changed.ok,'Edición persiste en mascota');
 check((await call({action:'save-pet',id,update:{nombre:'AJENO',fotos:[]}},other.token)).status===403,'Otra cuenta no edita mascota');
 const adoption=crypto.randomUUID(),home=crypto.randomUUID();
 const saved=await call({action:'save',item:{id:adoption,petId:id,name:'PRUEBA TEMPORAL PAWID',description:'Publicación de prueba de integración, no disponible para adopción.',images:[prepared.url],species:'Gato',size:'Pequeño',region:'Región Metropolitana de Santiago',comuna:'Santiago',adopted:true}},owner.token);
 check(saved.ok,'Adopción guardada en tabla original');created.adoptions.push(adoption);
 check((await call({action:'list'})).items.every(p=>p.id!==adoption),'Adopción privada no aparece como disponible');
 check((await call({action:'state',id:adoption,adopted:false},other.token)).status===403,'Otra cuenta no cambia adopción');
 check((await call({action:'state',id:adoption,adopted:false},owner.token)).ok,'Reactivación guardada');
 check((await call({action:'list'})).items.some(p=>p.id===adoption),'Nueva consulta pública recupera reactivación');
 await call({action:'state',id:adoption,adopted:true},owner.token);
 const savedHome=await call({action:'save-home',item:{id:home,name:'PRUEBA TEMPORAL PAWID',description:'Registro temporal de integración.',species:'Gato',size:'Pequeño',availability:'No disponible'}},owner.token);
 check(savedHome.ok&&savedHome.item.ownerId===owner.id,'Hogar usa propietario separado de publicación');created.homes.push(home);
 check((await call({action:'delete-home',id:home},other.token)).status===403,'Otra cuenta no elimina hogar');
 check((await call({action:'state-home',id:home,availability:'Disponible'},owner.token)).ok,'Disponibilidad de hogar guardada');
 check((await call({action:'list-homes'})).items.some(p=>p.id===home),'Nueva consulta recupera hogar disponible');
 await call({action:'state-home',id:home,availability:'No disponible'},owner.token);
 check((await call({action:'delete',id:adoption},owner.token)).ok,'Eliminación de adopción temporal');created.adoptions=[];
 check((await call({action:'delete-home',id:home},owner.token)).ok,'Eliminación de hogar temporal');created.homes=[];
 check((await call({action:'delete-pet',id},owner.token)).ok,'Eliminación de mascota temporal');created.pets=[];
 const removed=await fetch(base+'/storage/v1/object/mascotas-fotos',{method:'DELETE',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({prefixes:created.photos})});
 check(removed.ok,'Archivo temporal retirado sin tocar fotos existentes');created.photos=[];
 for(const user of created.users){await call({action:'logout'},user.token);check((await call({action:'session'},user.token)).status===401,'Cerrar sesión revoca su token');}
 console.log(JSON.stringify({ok:true,checks:checks.length,results:checks,cleanupUsers:created.users.map(({id,email})=>({id,email})),remaining:created.pets.concat(created.adoptions,created.homes,created.photos)}));
}
run().catch(error=>{console.log(JSON.stringify({ok:false,error:error.message,checks,cleanupUsers:created.users.map(({id,email})=>({id,email})),remaining:{pets:created.pets,adoptions:created.adoptions,homes:created.homes,photos:created.photos}}));process.exitCode=1;});
