const fs=require('node:fs'),assert=require('node:assert/strict');
async function run(){
  const app=fs.readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');
  const code=app.slice(app.indexOf('async function importBrowserData()'),app.indexOf("$('#import-browser-data')?.addEventListener"));
  const memory=new Map([
    ['pawid_pet_extras',JSON.stringify({pet:{fotos:['https://old/photo'],peso_kg:3,descripcion:'Local'},other:{descripcion:'AJENO'}})],
    ['pawid_adoptions',JSON.stringify([{id:'new',ownerId:'owner',petId:'pet',name:'Luna',image:'https://old/photo'},{id:'exists',ownerId:'owner',petId:'pet'},{id:'foreign',ownerId:'other',petId:'pet'},{id:'orphan',ownerId:'owner',petId:'missing'}])],
    ['pawid_homes',JSON.stringify([{id:'new-home',ownerId:'owner',name:'Hogar',availability:'Disponible'},{id:'demo-home',ownerId:'demo'}])]
  ]);
  const before=JSON.stringify([...memory]),saved=[],pets=[],messages=[],button={};
  const store={ready:async()=>true,listPets:async()=>[{id:'pet',nombre:'Luna',fotos:['https://server/photo'],descripcion:'Actual'}],savePet:async(id,value)=>pets.push({id,...value}),savePublication:async(type,item)=>saved.push({type,...item})};
  const importData=new Function('pawStore','localStorage','$','confirm','alert','currentUser','loadAdoptions','refreshPetsView','getAdoptionImages','remoteAdoptions','remoteHomes',code+';return importBrowserData;')(
    store,{getItem:key=>memory.get(key)},()=>button,()=>true,msg=>messages.push(msg),{id:'owner'},async()=>{},()=>{},item=>item.images||[item.image], [{id:'exists'}],[]);
  await importData();
  assert.equal(pets.length,1);assert.equal(pets[0].descripcion,'Actual');assert.equal(pets[0].peso_kg,3);assert.deepEqual(pets[0].fotos,['https://server/photo','https://old/photo']);
  assert.deepEqual(saved.map(row=>row.id),['new','new-home']);assert.equal(JSON.stringify([...memory]),before);assert.equal(button.disabled,false);assert.ok(messages[0].includes('Pendientes por error: 0'));
  console.log('8 comprobaciones de importación correctas: propiedad, vínculo, duplicados, fotografías, antecedentes y conservación local');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
