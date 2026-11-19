/* Backend opcional archivado, no requerido por la web actual. Sin red ni base real. */
async function runAdoptionChecks(source, app) {
  const results = [];
  const check = (value, label) => { if (!value) throw new Error(label); results.push(label); };
  const copy = value => JSON.parse(JSON.stringify(value));
  const db = {
    usuarios: [{id: 'owner', email: 'owner@test.cl', password: '70'.repeat(32), proveedor: 'email', nombre: 'Tutor'}],
    mascotas: [{id: 'pet', usuario_id: 'owner', nombre: 'Luna', fotos: ['https://test/a','https://test/b'], foto_path: 'https://test/a'}],
    pawid_web_sessions: [{token_hash: '61'.repeat(32), owner_id: 'owner', expires_at: '2099-01-01'}, {token_hash: '62'.repeat(32), owner_id: 'stranger', expires_at: '2099-01-01'}],
    publicaciones_hogares__temporales: [],
    publicacion_adopcion: [{id:'post',usuario_id:'owner',mascota_id:'pet',adoptado:false,nombre:'Luna',fotos:['https://test/a','https://test/b'],foto_mascota:'https://test/a',descripcion:'Descripción conservada'}]
  };
  let missingTable = '';
  function query(table) {
    const filters = []; let op = 'select', values, single = false, range, columns='*';
    const q = {
      select(value) {columns=value||'*';return q;}, eq(key, value) { filters.push(row => String(row[key]) === String(value)); return q; },
      gt(key, value) { filters.push(row => row[key] > value); return q; },
      or() { filters.push(row => row.proveedor === 'email' || row.proveedor == null); return q; },
      is(key, value) { filters.push(row => (row[key] ?? null) === value); return q; },
      order() { return q; }, limit(count) {range = [0, count - 1]; return q;}, range(start, end) { range = [start, end]; return q; },
      single() { single = true; return q; }, maybeSingle() { single = true; return q; },
      insert(value) { op = 'insert'; values = value; return q; }, update(value) { op = 'update'; values = value; return q; },
      delete() { op = 'delete'; return q; },
      then(resolve, reject) {
        try {
          if (table === missingTable) return Promise.resolve({data:null,error:{code:'42703'}}).then(resolve,reject);
          let rows = db[table].filter(row => filters.every(filter => filter(row)));
          if (op === 'insert') {
            const row = {...copy(values)};
            if (table === 'pawid_web_sessions') row.expires_at = '2099-01-01';
            if (table === 'mascotas') row.id = 'created-pet';
            db[table].push(row); rows = [row];
          }
          if (op === 'update') rows.forEach(row => Object.assign(row, copy(values)));
          if (op === 'delete') db[table] = db[table].filter(row => !rows.includes(row));
          if (range) rows = rows.slice(range[0], range[1] + 1);
          if(columns!=='*')rows=rows.map(row=>Object.fromEntries(columns.split(',').map(key=>[key,row[key]])));
          return Promise.resolve({data: copy(single ? rows[0] || null : rows), error: null}).then(resolve, reject);
        } catch (err) { return Promise.reject(err).then(resolve, reject); }
      }
    }; return q;
  }
  let bucketPublic = true,googleIdentity=null,uuidCounter=0;
  const signedPaths = [];
  const admin = {from: query, auth: {getUser: async token => token==='google-token'&&googleIdentity?({data:{user:googleIdentity}}):({error:'invalid'})}, storage:{
    getBucket: async () => ({data:{public:bucketPublic},error:null}),
    from: () => ({createSignedUploadUrl: async (path, options) => {signedPaths.push({path,options});return {data:{token:'signed'},error:null};},getPublicUrl: path => ({data:{publicUrl:'https://test/'+path}})})
  }};
  const fakeCrypto = {subtle: {digest: async (_alg, bytes) => new Uint8Array(32).fill(bytes[0])}, getRandomValues: bytes => {bytes.fill(99); return bytes;},randomUUID: () => 'unique-photo'+(uuidCounter++?'-'+uuidCounter:'')};
  class TestResponse { constructor(body, options) { this.body = body; this.status = options.status || 200; } }
  const TestURL=URL;
  class TestEncoder { encode(value) { return Uint8Array.from(Array.from(value).map(c => c.charCodeAt(0))); } }
  const create = new Function('URL', 'Response', 'TextEncoder', source.replace('export function', 'function') + ';return createHandler;')(TestURL, TestResponse, TestEncoder);
  // Supabase Auth simulado: las contraseñas viven en Auth, no en la tabla usuarios.
  const authUsers = {'owner@test.cl': {id: 'auth-owner', password: 'Password1!'}};
  const authClient = () => ({auth: {
    signInWithPassword: async ({email, password}) => authUsers[email] && authUsers[email].password === password
      ? {data: {user: {id: authUsers[email].id, email, app_metadata: {provider: 'email'}, user_metadata: {}}}, error: null}
      : {data: {}, error: {message: 'Invalid login credentials'}},
    signUp: async ({email, password, options}) => {
      if (authUsers[email]) return {data: null, error: {code: 'user_already_exists', message: 'User already registered'}};
      authUsers[email] = {id: 'auth-' + email, password};
      return {data: {user: {id: authUsers[email].id, email, identities: [{}], app_metadata: {provider: 'email'}, user_metadata: options?.data || {}}}, error: null};
    }
  }});
  let handler = create({admin, authClient, appUrl: 'https://test', cryptoImpl: fakeCrypto, now: () => 1760000000000});
  const request = async (body, token = '', bearer = '') => {
    const response = await handler({method: 'POST', text: async () => JSON.stringify(body), headers: {get: key => key === 'x-pawid-session' ? token : key==='authorization'?bearer:''}});
    return {status: response.status, ...JSON.parse(response.body)};
  };
  const owner = 'a'.repeat(64), stranger = 'b'.repeat(64);
  let health = await request({action:'health'});
  check(health.ready && health.checks.length === 6, 'Health revisa columnas y bucket sin leer filas');
  missingTable = 'mascotas'; health = await request({action:'health'}); missingTable = '';
  check(health.status === 503 && !health.ready, 'Health detecta migracion pendiente');
  check((await request({action:'prepare-photo-upload',type:'image/png',size:100})).status === 401, 'No se autoriza subir fotos sin sesion');
  const upload = await request({action:'prepare-photo-upload',type:'image/png',size:100},owner);
  check(upload.ok && upload.path === 'owner/unique-photo.png' && signedPaths[0].options.upsert === false, 'Subida firmada pertenece al propietario y no sobrescribe archivos');
  check((await request({action:'prepare-photo-upload',type:'image/png',size:10485761},owner)).status === 400, 'Servidor rechaza fotos mayores de 10 MB');
  bucketPublic = false;
  check((await request({action:'prepare-photo-upload',type:'image/png',size:100},owner)).status === 503, 'Bucket privado exige revision y no cambia su privacidad');
  bucketPublic = true;
  check((await request({action:'list-pets'},owner)).items.length === 1 && (await request({action:'list-pets'},stranger)).items.length === 0, 'Consulta de mascotas filtra el propietario en servidor');
  let response = await request({action: 'list'});
  check(response.items.length === 1, 'Invitado puede ver adopciones disponibles');
  check((await request({action: 'state', id: 'post', adopted: true})).status === 401, 'Invitado no puede cambiar estado por API');
  check((await request({action: 'state', id: 'post', adopted: true}, stranger)).status === 403, 'Otro usuario no puede cambiar estado');
  const before = JSON.stringify(db.publicacion_adopcion[0].fotos);
  response = await request({action: 'state', id: 'post', adopted: true}, owner);
  check(response.ok && db.publicacion_adopcion[0].adoptado, 'Propietario guarda estado adoptada');
  check((await request({action: 'list'})).items.length === 0, 'Adoptada desaparece del listado público');
  check((await request({action: 'list'}, owner)).items[0].adopted, 'Propietario conserva publicación adoptada en su listado');
  handler = create({admin, authClient, appUrl: 'https://test', cryptoImpl: fakeCrypto, now: () => 1760000000000});
  response = await request({action: 'state', id: 'post', adopted: false}, owner);
  check(response.ok && !db.publicacion_adopcion[0].adoptado, 'Reactivar guarda disponible en el servidor');
  handler = create({admin, authClient, appUrl: 'https://test', cryptoImpl: fakeCrypto, now: () => 1760000000000});
  response = await request({action: 'list'});
  check(response.items.some(row => row.id === 'post' && !row.adopted), 'Nueva instancia del servidor conserva reactivación pública');
  check(JSON.stringify(db.publicacion_adopcion[0].fotos) === before, 'Cambiar estado conserva datos y fotografías');
  response = await request({action: 'save', item: {id: 'post', petId: 'pet', ownerId: 'stranger', name: 'Luna', images: ['https://test/b','https://test/c']}}, stranger);
  check(response.status === 403, 'No se confía en ownerId enviado desde el navegador');
  response = await request({action: 'save', item: {id: 'post', petId: 'pet', name: 'Luna', images: ['https://test/b','https://test/c']}}, owner);
  check(response.ok && response.item.images.join() === 'https://test/b,https://test/c', 'Edición persiste eliminación y adición de fotos');
  const petUpdate = {nombre: 'Luna', especie:'Gato',raza:'Mestizo',fecha_nacimiento:null, fotos: ['https://test/b','https://test/c']};
  check((await request({action: 'save-pet', id: 'pet', update: petUpdate}, stranger)).status === 403, 'Edición de mascota valida propietario en servidor');
  response = await request({action: 'save-pet', id: 'pet', update: petUpdate}, owner);
  check(response.ok && db.mascotas[0].foto_path === 'https://test/b' && db.mascotas[0].fotos.length === 2, 'Mascota guarda galería y portada compatible');
  response = await request({action: 'create-pet', update: petUpdate}, owner);
  check(response.ok && db.mascotas[1].usuario_id === 'owner', 'Registro de mascota usa propietario de la sesión');
  check((await request({action: 'login', email: 'owner@test.cl', password: 'wrong'})).status === 401, 'Login rechaza credenciales incorrectas');
  response = await request({action: 'login', email: 'owner@test.cl', password: 'Password1!'});
  check(response.ok && /^[a-f0-9]{64}$/.test(response.token), 'Login valida con Supabase Auth y crea sesión de servidor');
  check(db.usuarios[0].auth_id === 'auth-owner', 'Login liga el perfil existente con su cuenta de Supabase Auth');
  check((await request({action: 'session'}, response.token)).user.id === 'owner', 'Sesión verificada persiste entre consultas');
  check((await request({action:'save-home',item:{id:'home',name:'Acogida',availability:'Disponible',ownerId:'stranger'}},owner)).item.ownerId==='owner','Hogar usa propietario del servidor, no el enviado');
  check((await request({action:'list-homes'})).items.length===1,'Invitado ve hogares disponibles');
  check((await request({action:'state-home',id:'home',availability:'No disponible'},stranger)).status===403,'Otra cuenta no cambia disponibilidad');
  check((await request({action:'delete-home',id:'home'},stranger)).status===403,'Otra cuenta no elimina el hogar');
  check((await request({action:'save-home',item:{id:'home',name:'Intruso',availability:'Disponible'}},stranger)).status===403,'Otra cuenta no edita el hogar');
  check((await request({action:'state-home',id:'home',availability:'Otra'},owner)).status===400,'Servidor valida disponibilidad');
  await request({action:'state-home',id:'home',availability:'No disponible'},owner);
  check((await request({action:'list-homes'})).items.length===0,'Hogar no disponible desaparece de lista pública');
  check((await request({action:'list-homes'},owner)).items[0].availability==='No disponible','Propietario conserva hogares no disponibles');
  handler=create({admin,authClient,appUrl:'https://test',cryptoImpl:fakeCrypto,now:()=>1760000000000});
  await request({action:'state-home',id:'home',availability:'Disponible'},owner);
  check((await request({action:'list-homes'})).items.length===1,'Reactivación persiste en una nueva instancia de servidor');
  await request({action:'delete-home',id:'home'},owner);
  check((await request({action:'list-homes'})).items.length===0,'Eliminar hogar persiste');
  check((await request({action:'delete-pet',id:'pet'},owner)).status===409,'No elimina mascota con publicaciones vinculadas');
  check((await request({action:'register',profile:{email:'new@test.cl',nombre:'Nuevo'},password:'123456'})).status===400,'Registro exige contraseña segura (RNF-03)');
  check((await request({action:'register',profile:{email:'new@test.cl',nombre:'Nuevo',telefono:'912345678'},password:'Segura123!'})).ok,'Registro crea la cuenta en Supabase Auth');
  const nuevo=db.usuarios.find(row=>row.email==='new@test.cl');
  check(nuevo&&nuevo.auth_id==='auth-new@test.cl'&&nuevo.password===''&&nuevo.telefono==='912345678','Registro crea el perfil ligado y sin hash de contraseña');
  check((await request({action:'register',profile:{email:'new@test.cl',nombre:'Nuevo'},password:'Segura123!'})).status===409,'Registro informa correo ya en uso');
  check((await request({action:'login',email:'new@test.cl',password:'Segura123!'})).ok,'Cuenta registrada inicia sesión');
  check((await request({action:'google-login'})).status===401,'Google requiere token verificado por Supabase Auth');
  googleIdentity={id:'auth-owner',email:'owner@test.cl',app_metadata:{provider:'google',providers:['email','google']},user_metadata:{full_name:'Google Tutor'}};
  let google=await request({action:'google-login'},'','Bearer google-token');
  check(google.ok&&google.token&&google.user.id==='owner','Google entra a la misma cuenta del correo (un correo = una cuenta)');
  check(db.usuarios.filter(row=>row.email==='owner@test.cl').length===1,'Google no duplica al usuario');
  googleIdentity={id:'auth-google',email:'google@test.cl',app_metadata:{provider:'google'},user_metadata:{full_name:'Tutor Google'}};
  google=await request({action:'google-login'},'','Bearer google-token');
  check(google.ok&&google.user.email==='google@test.cl'&&google.user.nombre==='Tutor Google','Google crea la cuenta desde la identidad verificada, sin contraseña adicional');
  check((await request({action:'login',email:'owner@test.cl',password:'Password1!',provider:'google'})).status===400,'Login con contraseña no acepta el proveedor Google');
  check((await request({action:'save-profile',profile:{nombre:'Intento',telefono:'912345678'}})).status===401,'Editar perfil requiere sesión');
  check((await request({action:'save-profile',profile:{nombre:' ',telefono:''}},owner)).status===400,'Perfil rechaza nombre vacío');
  check((await request({action:'save-profile',profile:{nombre:'Tutor',telefono:'123'}},owner)).status===400,'Perfil rechaza teléfono inválido');
  response=await request({action:'save-profile',profile:{id:'stranger',nombre:'Tutor editado',telefono:'+56 9 1234 5678',email:'intruso@test.cl'}},owner);
  check(response.ok&&response.user.id==='owner'&&response.user.nombre==='Tutor editado'&&response.user.telefono==='912345678','Perfil se guarda solo en la cuenta de la sesión');
  check(response.user.email==='owner@test.cl'&&!response.user.password,'Editar perfil conserva correo y no expone contraseña');
  check((await request({action:'session'},owner)).user.nombre==='Tutor editado','Otra consulta recupera el perfil actualizado');
  check((await request({action:'save-profile',profile:{nombre:'Tutor editado',telefono:'912345678',foto_path:'https://test/stranger/avatar.png'}},owner)).status===400,'Perfil rechaza foto de otra cuenta');
  check((await request({action:'save-profile',profile:{nombre:'Tutor editado',telefono:'912345678',foto_path:'https://test/owner/../stranger/avatar.png'}},owner)).status===400,'Perfil rechaza ruta de foto que sale de su carpeta');
  response=await request({action:'save-profile',profile:{nombre:'Tutor editado',telefono:'912345678',foto_path:'https://test/owner/avatar.png'}},owner);
  check(response.ok&&response.user.foto_path==='https://test/owner/avatar.png','Perfil guarda foto de la carpeta del propietario');
  check((await request({action:'session'},owner)).user.foto_path==='https://test/owner/avatar.png','Otra consulta recupera foto de perfil');
  response=await request({action:'save-profile',profile:{nombre:'Tutor editado',telefono:'912345678'}},owner);
  check(response.user.foto_path==='https://test/owner/avatar.png','Editar nombre sin foto conserva avatar existente');
  response=await request({action:'save-profile',profile:{nombre:'Tutor editado',telefono:'912345678',foto_path:''}},owner);
  check(response.ok&&response.user.foto_path==='','Se puede quitar la foto del perfil');
  await request({action: 'logout'}, owner);
  check((await request({action: 'state', id: 'post', adopted: true}, owner)).status === 401, 'Cerrar sesión revoca acciones del servidor');
  const controls = {'#adoption-show-mine': {}, '#new-adoption': {}};
  const controlsCode = app.slice(app.indexOf('function setAdoptionSessionControls()'), app.indexOf('async function loadAdoptions()'));
  const setControls = new Function('$', 'pawStore', 'let currentUser, adoptionViewMode;' + controlsCode + ';return (user,mode) => { currentUser=user; adoptionViewMode=mode; setAdoptionSessionControls(); return adoptionViewMode; };')(
    s => controls[s], {hasSession: () => true});
  setControls(null, 'mine');
  check(controls['#adoption-show-mine'].hidden && controls['#new-adoption'].hidden, 'Invitado no ve controles de publicación');
  setControls({id: 'owner'}, 'all');
  check(!controls['#adoption-show-mine'].hidden && !controls['#new-adoption'].hidden, 'Iniciar sesión muestra controles de publicación');
  check(setControls(null, 'mine') === 'all' && controls['#new-adoption'].hidden, 'Cerrar sesión oculta controles y restaura listado público');
  check(app.includes('!item.adopted'), 'Interfaz invierte el estado actual');
  return results;
}
if (typeof module !== 'undefined') {
  module.exports = runAdoptionChecks;
  if (require.main === module) {
    const fs = require('node:fs'), path = require('node:path');
    const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
    runAdoptionChecks(read('supabase/functions/pawid-api/handler.js'), read('js/app.js'))
      .then(results => console.log(results.length + ' comprobaciones correctas\n' + results.join('\n')))
      .catch(error => {console.error(error); process.exitCode = 1;});
  }
}
