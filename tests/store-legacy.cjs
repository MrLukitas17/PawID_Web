/* Compatibilidad sin cambios administrativos: node tests/store.cjs */
async function runStoreChecks(source) {
  const results = [], memory = new Map(), uploads = [];
  const check = (ok,label) => {if(!ok) throw new Error(label); results.push(label);};
  const copy = value => JSON.parse(JSON.stringify(value));
  let quota = false, failUpdate = false, failInsert = null, counter = 0, fromCalls = 0;
  const storage = {getItem:key=>memory.get(key)||null,removeItem:key=>memory.delete(key),setItem(key,value){if(quota&&key==='pawid_pet_extras')throw new Error('Quota');memory.set(key,value);}};
  const db = {usuarios:[{id:'owner',email:'owner@test.cl',password:'hash:correct',proveedor:'email',nombre:'Tutor'}],
    mascotas:[{id:'pet',usuario_id:'owner',nombre:'Luna',foto_path:'https://test/old'}, {id:'other',usuario_id:'other',nombre:'Otro',foto_path:'https://test/other'}]};
  const base = new Set(['id','usuario_id','nombre','especie','raza','fecha_nacimiento','dueno_nombre','dueno_telefono','foto_path']);
  function query(table) {
    const filters=[];let mode='read',value,one=false,selected='*';
    const q={select(columns){selected=columns;return q;},eq(k,v){filters.push(row=>String(row[k])===String(v));return q;},
      or(){filters.push(row=>row.proveedor==='email'||row.proveedor==null);return q;},maybeSingle(){one=true;return q;},single(){one=true;return q;},
      insert(v){mode='insert';value=Array.isArray(v)?v[0]:v;return q;},update(v){mode='update';value=v;return q;},delete(){mode='delete';return q;},
      then(resolve,reject){try{
        if(mode==='update'&&failUpdate)return Promise.resolve({data:null,error:{message:'Failed update'}}).then(resolve,reject);
        if(mode==='insert'&&failInsert){const error=failInsert;failInsert=null;return Promise.resolve({data:null,error}).then(resolve,reject);}
        if(table==='mascotas'&&value&&Object.keys(value).some(k=>!base.has(k)))throw new Error('Intento de usar una columna inexistente');
        let rows=db[table].filter(row=>filters.every(f=>f(row)));
        if(mode==='insert'){const row=copy(value);db[table].push(row);rows=[row];}
        if(mode==='update')rows.forEach(row=>Object.assign(row,copy(value)));
        if(mode==='delete')db[table]=db[table].filter(row=>!rows.includes(row));
        let data=rows.map(row=>selected==='*'?copy(row):Object.fromEntries(selected.split(',').map(k=>k.trim()).map(k=>[k,row[k]])));
        if(one)data=data[0]||null;
        return Promise.resolve({data,error:null}).then(resolve,reject);
      }catch(e){return Promise.reject(e).then(resolve,reject);}}
    };return q;
  }
  const client={from(table){fromCalls++;return query(table);},functions:{invoke(){throw new Error('No debe llamar a Edge Functions');}},
    storage:{from:()=>({upload:async(path,file,options)=>{uploads.push({path,file,options});return {error:null};},getPublicUrl:path=>({data:{publicUrl:'https://test/'+path}})})}};
  const root={crypto:{getRandomValues:values=>values.fill(++counter)}};
  new Function('window',source)(root);
  const create = () => root.PawLegacyStore.create(client,{storage,hash:p=>'hash:'+p,uuid:()=> 'new-'+(++counter)});
  let store=create();
  check(!store.hasSession(),'Carga como invitado sin token de servidor');
  try{await store.login('owner@test.cl','wrong');throw new Error('Se acepto clave incorrecta');}catch(e){check(e.message==='Correo o contraseña incorrectos.','Login anterior rechaza clave incorrecta');}
  const user=await store.login(' OWNER@test.cl ','correct');
  check(user.id==='owner'&&store.hasSession(),'Login anterior funciona sin pawid-api');
  check(!memory.get('pawid_user').includes('password')&&!memory.get('pawid_user').includes('hash:'),'Sesion no guarda la contrasena ni el hash');
  const before=fromCalls;store=create();
  check(store.user().id==='owner'&&fromCalls===before,'Recarga conserva la sesion anterior sin consultar funciones');
  check((await store.listPets()).length===1,'Consulta de mascotas usa el propietario actual');
  const update={nombre:'Luna',especie:'Gato',raza:'Mestizo',fecha_nacimiento:null,dueno_telefono:'912345678',peso_kg:3,vacunas:'Sí',descripcion:'Tranquila',fotos:['https://test/a','https://test/b']};
  await store.savePet('pet',update);
  check(db.mascotas[0].foto_path==='https://test/a'&&!Object.hasOwn(db.mascotas[0],'fotos'),'Guarda portada con el esquema original sin columnas nuevas');
  store=create();let pet=(await store.listPets())[0];
  check(pet.fotos.join()==='https://test/a,https://test/b'&&pet.peso_kg===3,'Recarga recupera fotos adicionales y extras de este navegador');
  await store.savePet('pet',{...update,fotos:pet.fotos});
  check((await store.listPets())[0].fotos.length===2,'Editar sin cambios mantiene fotografias');
  await store.savePet('pet',{...update,fotos:['https://test/b','https://test/c']});
  check((await store.listPets())[0].fotos.join()==='https://test/b,https://test/c','Quitar y agregar fotos conserva el orden');
  const saved=memory.get('pawid_pet_extras');failUpdate=true;
  try{await store.savePet('pet',{...update,fotos:[]});}catch{}
  failUpdate=false;
  check(memory.get('pawid_pet_extras')===saved&&db.mascotas[0].foto_path==='https://test/b','Error al guardar conserva fotos previas');
  try{await store.savePet('other',update);}catch(e){check(e.message==='No puedes modificar esta mascota.','Edicion conserva el filtro de propietario del sistema anterior');}
  const count=db.mascotas.length;quota=true;
  try{await store.createPet(update);}catch(e){check(e.message.includes('espacio'),'Almacenamiento lleno se informa antes de registrar');}
  quota=false;check(db.mascotas.length===count,'Almacenamiento lleno no crea una mascota incompleta');
  const created=await store.createPet(update);
  check(created.id&&db.mascotas.find(row=>row.id===created.id).usuario_id==='owner','Registro usa tablas y columnas existentes');
  check((await store.listPets()).find(row=>row.id===created.id).fotos.length===2,'Registro conserva galeria en este navegador');
  failInsert={code:'22P02'};const uuidPet=await store.createPet(update);
  check(uuidPet.id.startsWith('new-')&&/^\d+$/.test(created.id),'Conserva ID numerico original y admite UUID si el esquema lo exige');
  const file={name:'foto.png',type:'image/png',size:5};await store.uploadPhoto(file);
  check(uploads[0].path.startsWith('owner/')&&uploads[0].options.upsert===false,'Subida usa el bucket anterior sin sobrescribir fotos');
  store.clear();check(!store.hasSession(),'Cerrar sesion vuelve al estado invitado');
  check(!source.includes('functions.invoke'),'Modulo actual no depende de funciones externas');
  return results;
}
if(typeof module!=='undefined'){
  module.exports=runStoreChecks;
  if(require.main===module){const fs=require('node:fs'),path=require('node:path');runStoreChecks(fs.readFileSync(path.join(__dirname,'../js/store-legacy.js'),'utf8'))
    .then(r=>console.log(r.length+' comprobaciones correctas\n'+r.join('\n'))).catch(e=>{console.error(e);process.exitCode=1;});}
}
