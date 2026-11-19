/* Verifica el flujo del BPMN "Cambiar Contraseña" con los mismos nodos que usa el navegador:
   correo registrado -> código al correo -> validar código -> nueva contraseña. */
const fs=require('node:fs'),assert=require('node:assert/strict');
async function run(){
  let checks=0;const calls=[];let cleared=0;
  const check=(condition,label)=>{assert.ok(condition,label);checks++;};
  const app=fs.readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');
  const code=app.slice(app.indexOf('const recoveryModal='),app.indexOf('function normalizePhone'));
  const nodes={};const element=()=>({hidden:false,value:'',required:false,textContent:'',className:'',reset(){},addEventListener(name,fn){this[name]=fn;}});
  const $=id=>nodes[id]||(nodes[id]=element());
  const store={
    recoveryEmailExists:async email=>{calls.push(['exists',email]);return email==='owner@test.cl';},
    recoveryRequest:async email=>{calls.push(['request',email]);},
    recoveryVerify:async(email,codeValue)=>{calls.push(['verify',email,codeValue]);if(codeValue!=='123456')throw new Error('El código no es válido o ya venció.');},
    recoveryReset:async password=>{calls.push(['reset',password]);},
    clear:()=>cleared++
  };
  const open=new Function('$','pawStore','updateSessionUI','normalize','let currentUser={};'+code+';return openPasswordRecovery;')($,store,()=>{},v=>String(v).trim().toLowerCase());
  const submit=()=>$('#password-recovery-form').submit({preventDefault(){}});
  open();
  check(!$('#recovery-email-label').hidden&&$('#recovery-code-label').hidden&&$('#recovery-submit').textContent==='Enviar código','Paso 1 pide el correo');
  $('#recovery-email').value='nadie@test.cl';await submit();
  check($('#recovery-message').textContent==='Correo no encontrado.'&&!calls.some(c=>c[0]==='request'),'Correo no registrado: "Correo no encontrado" y no se envía código');
  $('#recovery-email').value='Owner@Test.cl';await submit();
  check(calls.some(c=>c[0]==='request'&&c[1]==='owner@test.cl')&&!$('#recovery-code-label').hidden,'Correo registrado: se envía el código y se pide ingresarlo');
  $('#recovery-code').value='000000';await submit();
  check($('#recovery-message').className.includes('error')&&$('#recovery-new-fields').hidden,'Código inválido no permite avanzar');
  $('#recovery-code').value='123456';await submit();
  check(!$('#recovery-new-fields').hidden,'Código válido muestra el formulario de nueva contraseña');
  $('#recovery-password').value='corta';$('#recovery-password-confirm').value='corta';await submit();
  check(!calls.some(c=>c[0]==='reset')&&$('#recovery-message').textContent.includes('necesita'),'Contraseña sin requisitos no se envía');
  $('#recovery-password').value='Segura123!';$('#recovery-password-confirm').value='Otra123!!';await submit();
  check(!calls.some(c=>c[0]==='reset'),'Contraseñas diferentes no se envían');
  $('#recovery-password-confirm').value='Segura123!';await submit();
  check(calls.some(c=>c[0]==='reset'&&c[1]==='Segura123!')&&cleared===1&&$('#recovery-message').textContent.includes('actualizada'),'Nueva contraseña se guarda y se cierra la sesión temporal');
  console.log(checks+' comprobaciones de recuperación correctas');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
