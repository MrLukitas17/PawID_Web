/* Verifica el formulario completo con los mismos nodos que usa el navegador. */
const fs=require('node:fs'),assert=require('node:assert/strict');
async function run(){
  let checks=0,available=false,sent=[],cleared=0;
  const check=(condition,label)=>{assert.ok(condition,label);checks++;};
  const app=fs.readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');
  const code=app.slice(app.indexOf('const recoveryModal='),app.indexOf('function normalizePhone'));
  function setup(hash){
    const nodes={};const element=()=>({hidden:false,value:'',required:false,addEventListener(name,fn){this[name]=fn;}});
    const select=id=>nodes[id]||(nodes[id]=element());
    const store={recoveryStatus:async()=>available,recover:async body=>{sent.push(body);},clear:()=>cleared++};
    const location={hash,pathname:'/templates/index.html',search:''};
    const state={};
    const open=new Function('$','pawStore','location','history','updateSessionUI', 'let currentUser={};'+code+';return openPasswordRecovery;')(select,store,location,{replaceState:(_,__,url)=>state.url=url},()=>{});
    return {nodes,select,open,state};
  }
  let ui=setup('');await ui.open();check(ui.select('#recovery-submit').hidden,'Servicio ausente mantiene el formulario deshabilitado');
  available=true;await ui.open();check(!ui.select('#recovery-email-label').hidden&&ui.select('#recovery-submit').textContent==='Enviar enlace','Servicio disponible pide correo');
  ui.select('#recovery-email').value='owner@test.cl';await ui.select('#password-recovery-form').submit({preventDefault(){}});
  check(sent[0].action==='request'&&sent[0].email==='owner@test.cl','Solicitud de recuperación llega al servicio');
  ui=setup('#login?token='+'a'.repeat(64));await ui.open();check(!ui.select('#recovery-new-fields').hidden&&ui.select('#recovery-email-label').hidden,'Enlace habilita nueva contraseña');
  ui.select('#recovery-password').value='123456';ui.select('#recovery-password-confirm').value='other';await ui.select('#password-recovery-form').submit({preventDefault(){}});
  check(sent.length===1,'Contraseñas diferentes no se envían');
  ui.select('#recovery-password-confirm').value='123456';await ui.select('#password-recovery-form').submit({preventDefault(){}});
  check(sent[1].action==='reset'&&sent[1].token==='a'.repeat(64),'Token y contraseña llegan al servicio de recuperación');
  check(cleared===1&&ui.state.url==='/templates/index.html#login','Cambio elimina sesión y token de la dirección');
  console.log(checks+' comprobaciones de recuperación correctas');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
