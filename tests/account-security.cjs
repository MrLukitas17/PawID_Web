const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
async function run(){
 let clock=0,checks=0;const window={};new Function('window',fs.readFileSync(path.join(__dirname,'../js/account-security.js'),'utf8'))(window);
 const service=window.PawAccountSecurity.create({now:()=>clock}),user={id:'owner',email:'owner@test.cl',proveedor:'email'},other={id:'other',email:'other@test.cl',proveedor:'email'},google={id:'google',email:'google@test.cl',proveedor:'google'};
 const check=(value,label)=>{assert.ok(value,label);checks++;};
 async function rejected(fn,label){let blocked=false;try{await fn();}catch{blocked=true;}check(blocked,label);}
 await rejected(()=>service.start(null,'email'),'Invitado no solicita código');
 await rejected(()=>service.start(google,'email'),'Google no modifica correo');
 await rejected(()=>service.start(google,'password'),'Google no entra en cambio manual de credenciales');
 await service.start(user,'email');await rejected(()=>service.complete(user,{email:'new@test.cl'}),'No permite saltarse el código');
 await rejected(()=>service.verify(other,'123456'),'Verificación ligada a la cuenta que solicitó');
 for(let i=0;i<4;i++)await rejected(()=>service.verify(user,'000000'),'Código incorrecto');
 await service.verify(user,'123456');const before=JSON.stringify(user);const result=await service.complete(user,{email:'new@test.cl'});check(result.simulation&&result.changed===false&&JSON.stringify(user)===before,'El código correcto en el último intento permite simulación sin cambiar la cuenta');
 await rejected(()=>service.complete(user,{email:'another@test.cl'}),'Verificación se consume una vez');
 await service.start(user,'password');await service.verify(user,'123456');await rejected(()=>service.complete(user,{password:'abc',confirmPassword:'abc'}),'Valida longitud');
 await rejected(()=>service.complete(user,{password:'12345678',confirmPassword:'87654321'}),'Valida confirmación');
 const complete=await service.complete(user,{password:'12345678',confirmPassword:'12345678'});check(complete.changed===false&&!('password'in complete),'No guarda ni devuelve contraseña de simulación');
 await service.start(user,'email');clock+=600001;await rejected(()=>service.verify(user,'123456'),'Código vence');
 await service.start(user,'email');for(let i=0;i<5;i++)try{await service.verify(user,'000000');}catch{}await rejected(()=>service.verify(user,'123456'),'Bloquea tras cinco códigos erróneos');
 await service.start(user,'email');service.reset();await rejected(()=>service.verify(user,'123456'),'Cerrar o cancelar invalida verificación');
 console.log(checks+' comprobaciones de seguridad simulada correctas');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
