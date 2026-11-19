/* Adaptador de simulación. No envía correos, no escribe credenciales ni usa Supabase.
   La interfaz start/verify/complete permite sustituirlo después por un servicio real. */
(function(root){
 function create({now=()=>Date.now()}={}){
  let challenge=null,sequence=0;
  function manual(user){if(!user?.id)throw Error('Inicia sesión para continuar.');if(String(user.proveedor||'email').toLowerCase()==='google')throw Error('El correo vinculado a Google no se puede editar ni desvincular desde PawID.');}
  function active(user){manual(user);if(!challenge||String(user.id)!==challenge.owner)throw Error('Primero solicita un código de verificación.');if(now()>=challenge.expiresAt){challenge=null;throw Error('El código venció. Solicita uno nuevo.');}if(challenge.attempts>=5){challenge=null;throw Error('Se agotaron los intentos. Solicita un código nuevo.');}}
  return {
   mode:'simulation',
   reset(){challenge=null;},
   async start(user,kind){manual(user);if(!['email','password'].includes(kind))throw Error('Selecciona qué dato quieres cambiar.');challenge={id:String(++sequence),owner:String(user.id),kind,expiresAt:now()+10*60*1000,attempts:0,verified:false};return {simulation:true,challengeId:challenge.id,expiresAt:challenge.expiresAt,email:user.email};},
   async verify(user,code){active(user);if(String(code).trim()!=='123456'){challenge.attempts++;throw Error('Código incorrecto. Inténtalo nuevamente.');}challenge.verified=true;return {simulation:true,kind:challenge.kind};},
   async complete(user,values){
    active(user);if(!challenge.verified)throw Error('Verifica el código antes de cambiar tus datos.');
    const kind=challenge.kind;
    if(kind==='email'){const email=String(values.email||'').trim().toLowerCase();if(email.length>254||!/^([^\s@]+)@([^\s@]+)[.]([^\s@]+)$/.test(email))throw Error('Ingresa un correo válido.');if(email===String(user.email||'').toLowerCase())throw Error('Ingresa un correo distinto al actual.');}
    else{if(typeof values.password!=='string'||values.password.length<8||values.password.length>128)throw Error('La contraseña debe tener entre 8 y 128 caracteres.');if(values.password!==values.confirmPassword)throw Error('Las contraseñas no coinciden.');}
    challenge=null;return {simulation:true,kind,changed:false};
   }
  };
 }
 root.PawAccountSecurity={create};
})(window);
