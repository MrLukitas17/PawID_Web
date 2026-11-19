async function runAPIChecks(source) {
  const results = [], storage = new Map(), window = {};
  const localStorage = {getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  new Function('window','localStorage',source)(window,localStorage);
  const check = (ok,label)=>{if(!ok)throw new Error(label);results.push(label);};
  let mode='404', uploadArgs;
  const client={functions:{invoke:async()=>{
    if(mode==='404')return {error:{context:{status:404,json:async()=>({code:'NOT_FOUND'})}}};
    if(mode==='401')return {error:{context:{status:401,json:async()=>({message:'Clave incorrecta.'})}}};
    if(mode==='login')return {data:{ok:true,user:{id:'owner'},token:'test-session'}};
    return {data:{ok:true,bucket:'mascotas-fotos',path:'owner/new.png',token:'one-file-token',url:'https://test/new.png'}};
  }},storage:{from:()=>({uploadToSignedUrl:async(...args)=>{uploadArgs=args;return {error:null};}})}};
  const api=window.PawAdoptionsAPI.create(client);
  try {await api.login('test@test.cl','test');} catch(error){check(error.status===404&&error.message.includes('Falta desplegar'),'404 explica la funcion pendiente');}
  mode='401';
  try {await api.login('test@test.cl','test');} catch(error){check(error.status===401&&error.message==='Clave incorrecta.','Login conserva el error real del servidor');}
  mode='login';await api.login('test@test.cl','test');
  check(api.hasSession()&&storage.get('pawid_server_session')==='test-session','Login guarda solo la sesion emitida por el servidor');
  mode='upload';const file={name:'new.png',type:'image/png',size:10};
  const url=await api.uploadPhoto(file);
  check(url==='https://test/new.png'&&uploadArgs[0]==='owner/new.png'&&uploadArgs[1]==='one-file-token'&&uploadArgs[2]===file,'Foto usa la autorizacion firmada de un archivo');
  check(![...storage.values()].includes('test'),'No se persiste la contrasena');
  return results;
}
if(typeof module!=='undefined'){
  module.exports=runAPIChecks;
  if(require.main===module){const fs=require('node:fs'),path=require('node:path');runAPIChecks(fs.readFileSync(path.join(__dirname,'../js/adoptions-api.js'),'utf8'))
    .then(r=>console.log(r.length+' comprobaciones correctas\n'+r.join('\n'))).catch(e=>{console.error(e);process.exitCode=1;});}
}
