/* Prueba real de perfil; solo opera una cuenta temporal creada por este script. */
if(!process.argv.includes('--confirm-live-test')){console.log('Prueba real deshabilitada. Requiere --confirm-live-test.');process.exit(0);}
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const config=fs.readFileSync(path.join(__dirname,'../js/config.js'),'utf8');
const url=/supabaseUrl:\s*'([^']+)'/.exec(config)[1],key=/publishableKey:\s*'([^']+)'/.exec(config)[1];
let created=null,photoPath=null;let checks=0;
const check=(condition,label)=>{if(!condition)throw Error(label);checks++;};
async function request(body,token){const response=await fetch(url+'/functions/v1/pawid-api',{method:'POST',headers:{apikey:key,'Content-Type':'application/json',...(token?{'x-pawid-session':token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});return {status:response.status,...await response.json()};}
async function run(){
 const email='pawid-profile-'+crypto.randomUUID()+'@example.invalid',password=crypto.randomBytes(24).toString('hex');
 const signup=await request({action:'register',profile:{nombre:'Prueba perfil temporal',email,telefono:''},password});check(signup.ok,'Registro temporal');
 const login=await request({action:'login',email,password});check(login.ok,'Acceso temporal');created={id:login.user.id,email};
 check((await request({action:'save-profile',profile:{nombre:'No autorizado',telefono:''}})).status===401,'Sin sesión no edita');
 check((await request({action:'save-profile',profile:{nombre:'Nombre',telefono:'123'}},login.token)).status===400,'Rechaza teléfono inválido');
 const prepared=await request({action:'prepare-photo-upload',type:'image/png',size:68},login.token);check(prepared.ok,'Autoriza foto propia');
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQ0AAAAASUVORK5CYII=','base64');
 const uploaded=await fetch(url+'/storage/v1/object/upload/sign/'+prepared.bucket+'/'+prepared.path+'?token='+encodeURIComponent(prepared.token),{method:'PUT',headers:{'Content-Type':'image/png','x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(20000)});check(uploaded.ok,'Guarda imagen temporal');photoPath=prepared.path;
 const saved=await request({action:'save-profile',profile:{id:'00000000-0000-0000-0000-000000000000',email:'cambio-ignorado@example.invalid',nombre:'Prueba perfil actualizada',telefono:'+56 9 8765 4321',foto_path:prepared.url}},login.token);
 check(saved.ok&&saved.user.id===created.id&&saved.user.nombre==='Prueba perfil actualizada'&&saved.user.telefono==='987654321','Guarda nombre y teléfono solo en su cuenta');
 check(saved.user.email===email&&!saved.user.password,'Conserva correo y no devuelve contraseña');
 check(saved.user.foto_path===prepared.url,'Foto guardada en el perfil');
 const session=await request({action:'session'},login.token);check(session.user.nombre===saved.user.nombre&&session.user.telefono===saved.user.telefono&&session.user.foto_path===prepared.url,'Otra consulta recupera perfil actualizado');
 const removedPhoto=await request({action:'save-profile',profile:{nombre:'Prueba perfil actualizada',telefono:'987654321',foto_path:''}},login.token);check(removedPhoto.ok&&removedPhoto.user.foto_path==='','Puede quitar foto del perfil');
 const removed=await fetch(url+'/storage/v1/object/mascotas-fotos',{method:'DELETE',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[photoPath]}),signal:AbortSignal.timeout(20000)});check(removed.ok,'Retira solo la imagen temporal');photoPath=null;
 await request({action:'logout'},login.token);
 console.log(JSON.stringify({ok:true,checks,cleanupUser:created,remainingPhoto:photoPath}));
}
run().catch(error=>{console.log(JSON.stringify({ok:false,error:error.message,checks,cleanupUser:created}));process.exitCode=1;});
