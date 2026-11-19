/* Solo pruebas locales: ninguna operacion sale hacia Supabase. */
if (!localStorage.getItem('pawid_browser_stage')) localStorage.clear();
const testPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQ0AAAAASUVORK5CYII=';
const testOwner = {id:'owner',nombre:'Tutor',email:'owner@test.cl',telefono:'912345678',proveedor:'email'};
const initialPet = {id:'pet',usuario_id:'owner',nombre:'Luna',especie:'Gato',raza:'Mestizo',foto_path:testPhoto};
const initialPosts = [{id:'post',ownerId:'owner',petId:'pet',name:'Luna con un nombre bastante largo para probar la tarjeta',species:'Gato',breed:'Mestizo',age:'2 años',images:[testPhoto,testPhoto],image:testPhoto,description:'Una descripción para revisar el tamaño uniforme de la tarjeta.',adopted:false},
  {id:'other',ownerId:'other',petId:'other-pet',name:'Otra mascota',species:'Gato',image:testPhoto,adopted:false}];
if (!localStorage.getItem('pawid_adoptions')) localStorage.setItem('pawid_adoptions',JSON.stringify(initialPosts));
if (!localStorage.getItem('pawid_test_pets')) localStorage.setItem('pawid_test_pets',JSON.stringify([initialPet]));
if (!localStorage.getItem('pawid_pet_extras')) localStorage.setItem('pawid_pet_extras',JSON.stringify({pet:{fotos:[testPhoto,testPhoto]}}));
if(!localStorage.getItem('pawid_test_posts'))localStorage.setItem('pawid_test_posts',JSON.stringify(initialPosts));
const readPosts=()=>JSON.parse(localStorage.getItem('pawid_test_posts'));
const mockDB = {usuarios:[{...testOwner,password:'test-hash'}],mascotas:JSON.parse(localStorage.getItem('pawid_test_pets'))};
const testPet = mockDB.mascotas[0];
if(!testPet.fotos)testPet.fotos=[testPhoto,testPhoto];
function mockQuery(table) {
  const filters=[]; let operation='read',payload,single=false,columns='*';
  const query = {
    select(value){columns=value;return query;},eq(key,value){filters.push(row=>String(row[key])===String(value));return query;},
    or(){filters.push(row=>row.proveedor==='email'||row.proveedor==null);return query;},order(){return query;},
    single(){single=true;return query;},maybeSingle(){single=true;return query;},
    insert(value){operation='insert';payload=Array.isArray(value)?value[0]:value;return query;},
    update(value){operation='update';payload=value;return query;},delete(){operation='delete';return query;},
    then(resolve,reject){
      try {
        let rows=mockDB[table].filter(row=>filters.every(f=>f(row)));
        if(operation==='insert'){const row={...payload};mockDB[table].push(row);rows=[row];}
        if(operation==='update')rows.forEach(row=>Object.assign(row,payload));
        if(operation==='delete')mockDB[table]=mockDB[table].filter(row=>!rows.includes(row));
        if(table==='mascotas'&&operation!=='read')localStorage.setItem('pawid_test_pets',JSON.stringify(mockDB.mascotas));
        const values=rows.map(row=>columns==='*'?{...row}:Object.fromEntries(columns.split(',').map(k=>k.trim()).map(k=>[k,row[k]])));
        return Promise.resolve({data:single?values[0]||null:values,error:null}).then(resolve,reject);
      } catch(error){return Promise.reject(error).then(resolve,reject);}
    }
  };
  return query;
}
const mockClient = {
  auth:{signOut:async()=>({}),getSession:async()=>({data:{session:null}})},
  functions:{async invoke(name,{body={},headers={}}={}){
    const action=body.action;
    const ok=data=>({data:{ok:true,...data}});
    const fail=(status,message)=>({error:{context:{status,json:async()=>({message})}}});
    if(name==='password-recovery')return ok({ready:false});
    if(action==='health')return ok({ready:true,version:3});
    if(action==='login')return ok({user:testOwner,token:'a'.repeat(64)});
    const signed=headers['x-pawid-session']==='a'.repeat(64);
    if(action==='list'){const posts=readPosts();return ok({items:posts.filter(row=>!row.adopted||(signed&&row.ownerId==='owner'))});}
    if(action==='list-homes')return ok({items:JSON.parse(localStorage.getItem('pawid_test_homes')||'[]')});
    if(!signed)return fail(401,'Inicia sesión');
    if(action==='session')return ok({user:testOwner});
    if(action==='save-profile'){Object.assign(testOwner,{nombre:body.profile.nombre,telefono:body.profile.telefono});if(Object.hasOwn(body.profile,'foto_path'))testOwner.foto_path=body.profile.foto_path;return ok({user:testOwner});}
    if(action==='logout')return ok({});
    if(action==='list-pets')return ok({items:JSON.parse(localStorage.getItem('pawid_test_pets')).map(pet=>({...pet,fotos:pet.fotos||[testPhoto,testPhoto]}))});
    if(action==='save-pet'){
      Object.assign(testPet,body.update,{foto_path:body.update.fotos[0]||''});localStorage.setItem('pawid_test_pets',JSON.stringify(mockDB.mascotas));return ok({pet:{id:body.id}});
    }
    if(action==='prepare-photo-upload')return ok({bucket:'mascotas-fotos',path:'owner/new',token:'signed',url:testPhoto});
    if(['state','save','delete'].includes(action)){
      const posts=readPosts(),item=posts.find(row=>row.id===(body.id||body.item?.id));
      if(item&&item.ownerId!=='owner')return fail(403,'Publicación ajena');
      if(action==='state')item.adopted=body.adopted;
      if(action==='save'){if(item)Object.assign(item,body.item);else posts.push({...body.item,ownerId:'owner'});}
      if(action==='delete')posts.splice(posts.indexOf(item),1);
      localStorage.setItem('pawid_test_posts',JSON.stringify(posts));return ok({item:action==='save'?body.item:item});
    }
    return fail(400,'Acción no simulada: '+action);
  }},
  from:mockQuery,
  storage:{from:()=>({uploadToSignedUrl:async()=>({error:null}),upload:async()=>({error:null}),getPublicUrl:()=>({data:{publicUrl:testPhoto}})})}
};
window.supabase={createClient:()=>mockClient};
window.CryptoJS={SHA256:()=>({toString:()=>'test-hash'})};
window.alert=message=>{document.documentElement.dataset.lastAlert=message;};
window.confirm=()=>true;
function browserReport(error) {
  let output=document.getElementById('browser-check-results');
  if(!output){output=document.createElement('pre');output.id='browser-check-results';output.hidden=true;document.body.append(output);}
  output.textContent=JSON.stringify({ok:false,error:String(error)});
  if(parent!==window)parent.postMessage({pawidBrowserReport:output.textContent},'*');
}
window.addEventListener('error',event=>browserReport(event.error||event.message));
window.addEventListener('unhandledrejection',event=>browserReport(event.reason));
