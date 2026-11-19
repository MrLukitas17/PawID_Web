/* Integración de la capa del navegador; sin red ni datos reales. */
const fs=require('node:fs'),assert=require('node:assert/strict');
async function run(){
  const source=fs.readFileSync(require('node:path').join(__dirname,'../js/store.js'),'utf8');
  let checks=0;const check=(value,label)=>{assert.ok(value,label);checks++;};
  const memory=new Map(), storage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
  let mode='ready',legacyCalls=0,healthCalls=0;const posts=[],homes=[],pets=[{id:'pet',nombre:'Luna',fotos:['https://test/a','https://test/b'],peso_kg:3}];
  const root={localStorage:storage,PawLegacyStore:{create:()=>({user:()=>JSON.parse(storage.getItem('pawid_user')||'null'),login:async()=>{legacyCalls++;const user={id:'owner'};storage.setItem('pawid_user',JSON.stringify(user));return user;},listPets:async()=>{legacyCalls++;return [{id:'old'}];}})}};
  const error=(status,message)=>({error:{context:{status,json:async()=>({message})}}});
  const calls=[];
  const client={functions:{invoke:async(name,options)=>{
    const body=options.body||{},action=body.action;calls.push({name,...options});
    if(name==='password-recovery')return {data:{ok:true,ready:true}};
    if(action==='health'){healthCalls++;if(mode==='missing')return error(404);if(mode==='unready')return error(503,'Faltan tablas');if(mode==='network')return error(0);return {data:{ok:true,ready:true,version:3}};}
    if(action==='login')return {data:{ok:true,user:{id:'owner',nombre:'Tutor',password:'NEVER'},token:'a'.repeat(64)}};
    if(action==='session')return mode==='expired'?error(401,'Sesión vencida'):{data:{ok:true,user:{id:'owner',nombre:'Tutor'}}};
    if(action==='list-pets')return {data:{ok:true,items:pets}};
    if(action==='save-pet'){Object.assign(pets.find(p=>p.id===body.id),body.update);return {data:{ok:true,pet:{id:body.id}}};}
    if(action==='create-pet'){pets.push({id:'new',...body.update});return {data:{ok:true,pet:{id:'new'}}};}
    if(action==='prepare-photo-upload')return {data:{ok:true,bucket:'mascotas-fotos',path:'owner/photo',token:'signed',url:'https://test/photo'}};
    const list=action.includes('home')?homes:posts;
    if(['list','list-homes'].includes(action))return {data:{ok:true,items:JSON.parse(JSON.stringify(list))}};
    if(['save','save-home'].includes(action)){list.push({...body.item,ownerId:'owner'});return {data:{ok:true,item:list.at(-1)}};}
    if(['state','state-home'].includes(action)){const item=list.find(p=>p.id===body.id);if(action==='state')item.adopted=body.adopted;else item.availability=body.availability;return {data:{ok:true,item}};}
    if(['delete','delete-home'].includes(action)){list.splice(list.findIndex(p=>p.id===body.id),1);return {data:{ok:true}};}
    return {data:{ok:true}};
  }},storage:{from:()=>({uploadToSignedUrl:async(path,token)=>{check(path==='owner/photo'&&token==='signed','Usa autorización de archivo emitida por servidor');return {error:null};}})}};
  new Function('window',source)(root);const create=()=>root.PawStore.create(client,{storage});
  let store=create();await Promise.all([store.ready(),store.ready()]);check(healthCalls===1,'Deduplica diagnóstico concurrente');
  await store.login('owner@test.cl','password');check(store.hasSession()&&!storage.getItem('pawid_user').includes('NEVER'),'Perfil guardado excluye contraseña');
  const post={id:'post',name:'Luna',petId:'pet',images:['https://test/a','https://test/b']};
  await store.savePublication('adoption',post);await store.savePublication('home',{id:'home',name:'Acogida',availability:'Disponible'});
  check(!storage.getItem('pawid_adoptions')&&!storage.getItem('pawid_homes'),'Publicaciones nunca se guardan en localStorage');
  store=create();check((await store.listPublications('adoption'))[0].images.length===2,'Nueva instancia recupera fotos del servidor');
  await store.changePublicationState('adoption','post',true);await store.changePublicationState('home','home','No disponible');
  check(posts[0].adopted&&homes[0].availability==='No disponible','Cambios de estado llegan al servidor');
  check((await create().listPets())[0].peso_kg===3,'Antecedentes de mascotas sobreviven otra instancia');
  await store.savePet('pet',{nombre:'Luna',fotos:['https://test/b','https://test/c']});check(pets[0].fotos.join()==='https://test/b,https://test/c','Editar fotos persiste el orden en servidor');
  await store.createPet({nombre:'Nuevo',fotos:[]});check(pets.length===2,'Registro de mascota usa API');
  await store.uploadPhoto({name:'foto.png',type:'image/png',size:10});
  await store.deletePublication('adoption','post');check(posts.length===0,'Eliminar publicación llega al servidor');
  check(calls.some(call=>call.body.action==='save'&&call.headers['x-pawid-session']==='a'.repeat(64)),'Escrituras incluyen sesión de servidor');
  mode='expired';store=create();check(await store.ensureSession()===null&&!storage.getItem('pawid_user')&&!storage.getItem('pawid_server_session'),'Sesión vencida elimina credenciales locales');
  mode='missing';store=create();await store.login('a','b');check(legacyCalls===1,'API ausente conserva acceso anterior');
  let blocked=false;try{await store.savePublication('home',{id:'no-save'});}catch{blocked=true;}
  check(blocked&&!storage.getItem('pawid_homes'),'API ausente no simula guardado de publicaciones');
  for(const value of ['unready','network']){mode=value;store=create();const before=legacyCalls;let failed=false;try{await store.login('a','b');}catch{failed=true;}check(failed&&legacyCalls===before,'No retrocede al login antiguo ante '+value);}
  mode='missing';root.PawIDConfig={requireBackend:true};store=create();let unavailable=false;const before=legacyCalls;try{await store.login('a','b');}catch{unavailable=true;}check(unavailable&&legacyCalls===before,'Modo activo no utiliza guardado local ni acceso heredado si falla el servidor');
  console.log(checks+' comprobaciones de conexión correctas');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
