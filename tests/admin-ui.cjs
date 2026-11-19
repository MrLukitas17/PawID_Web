const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createAPI, imageURL, displayDate, STORAGE_KEY} = require('../js/admin.js');
const secret = 'NO_DEBE_APARECER_EN_ERRORES';
function setup() {
  const state = {session: {access_token: 'jwt-1', user: {id: 'admin'}}, calls: [], denied: [], mode: 'ok'};
  const client = {
    auth: {
      async getSession() {
        if (state.mode === 'session-throw') throw new Error(secret);
        return {data: {session: state.session}, error: state.mode === 'session-error' ? {message: secret} : null};
      },
      async signInWithPassword(credentials) {
        state.credentials = credentials;
        if (state.mode === 'login-throw') throw new Error(secret);
        return {data: {session: state.session}, error: state.mode === 'login-error' ? {message: secret} : null};
      },
      async signOut(options) { state.logout = options; state.session = null; return {error: null}; }
    },
    functions: {async invoke(name, options) {
      state.calls.push({name, ...options});
      if (state.mode === 'network') throw new Error(secret);
      if (Number.isInteger(state.mode)) return {error: {message: secret,
        context: new Response(JSON.stringify({error: 'Error seguro del servidor.'}), {status: state.mode})}};
      if (state.mode === 'invalid') return {data: {ok: false}};
      return {data: {ok: true, items: [], total: 0}};
    }}
  };
  return {state, client, api: createAPI(client, async message => { state.denied.push(message); })};
}
test('La API administrativa siempre usa pawid-admin y el JWT vigente de Auth', async () => {
  const {state, api} = setup();
  await api.call('listar_adopciones', {pagina: 2, tamano_pagina: 12});
  state.session.access_token = 'jwt-renovado'; await api.call('dashboard');
  assert.equal(state.calls[0].name, 'pawid-admin');
  assert.equal(state.calls[0].headers.Authorization, 'Bearer jwt-1');
  assert.equal(state.calls[1].headers.Authorization, 'Bearer jwt-renovado');
  assert.deepEqual(state.calls[0].body, {action: 'listar_adopciones', pagina: 2, tamano_pagina: 12});
});
test('No admite acciones adicionales ni permite sobrescribir action desde parámetros', async () => {
  const {state, api} = setup();
  for (const action of ['sql', 'listar_usuarios', 'listar_mascotas', 'eliminar_usuario', 'toString', '__proto__']) await assert.rejects(api.call(action), error => error.status === 400);
  assert.equal(state.calls.length, 0);
  await api.call('dashboard', {action: 'sql'}); assert.equal(state.calls[0].body.action, 'dashboard');
});
test('Una sesión ausente o fallida nunca produce una consulta de datos privados', async () => {
  for (const mode of ['missing', 'session-error', 'session-throw']) {
    const {state, api} = setup(); state.mode = mode; if (mode === 'missing') state.session = null;
    await assert.rejects(api.call('dashboard'), error => error.status === 401 && !error.message.includes(secret));
    assert.equal(state.calls.length, 0); assert.equal(state.denied.length, 1);
  }
});
test('Las respuestas 401 y 403 activan el cierre del acceso administrativo', async () => {
  for (const status of [401, 403]) {
    const {state, api} = setup(); state.mode = status;
    await assert.rejects(api.call('dashboard'), error => error.status === status && !error.message.includes(secret));
    assert.equal(state.denied.length, 1);
  }
});
test('Fallo de red y respuesta malformada no conceden autorización ni exponen errores internos', async () => {
  for (const mode of ['network', 'invalid']) {
    const {state, api} = setup(); state.mode = mode;
    await assert.rejects(api.call('dashboard'), error => !error.message.includes(secret));
    assert.equal(state.denied.length, 0);
  }
});
test('El login utiliza signInWithPassword y el logout restringe el cierre a esta sesión', async () => {
  const {state, api} = setup(); await api.login(' admin@example.test ', 'clave-de-prueba');
  assert.deepEqual(state.credentials, {email: 'admin@example.test', password: 'clave-de-prueba'});
  await api.logout(); assert.deepEqual(state.logout, {scope: 'local'});
  assert.notEqual(STORAGE_KEY, 'pawid_user'); assert.equal(STORAGE_KEY, 'pawid-admin-auth-v1');
});
test('Los errores de login no muestran el mensaje interno del SDK', async () => {
  for (const mode of ['login-error', 'login-throw']) {
    const {state, api} = setup(); state.mode = mode;
    await assert.rejects(api.login('admin@example.test', 'prueba'), error => !error.message.includes(secret));
  }
});
test('Las imágenes solo usan protocolos seguros o rutas de Storage acotadas', () => {
  const config = {supabaseUrl: 'https://proyecto.example.test', bucket: 'mascotas-fotos'};
  assert.equal(imageURL('https://example.test/foto.jpg', config), 'https://example.test/foto.jpg');
  assert.equal(imageURL('usuario/foto con espacio.jpg', config), 'https://proyecto.example.test/storage/v1/object/public/mascotas-fotos/usuario/foto%20con%20espacio.jpg');
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'https://user:pass@example.test/x', '../x', '//otro.test/x']) assert.equal(imageURL(url, config), '');
  assert.equal(imageURL('usuario/foto.jpg', config, false), '');
});
test('Las fechas de nacimiento sin hora conservan el día de calendario', () => {
  assert.equal(displayDate('2026-01-02'), '02/01/2026');
  assert.equal(displayDate(null), 'Sin información');
});
test('El frontend no contiene secretos, acceso directo a tablas ni autorización por localStorage', () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/admin.js'), 'utf8');
  assert.ok(!source.includes('SUPABASE_SERVICE_ROLE_KEY'));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!/\b(?:client|supabase)\.from\s*\(/.test(source));
  assert.ok(!source.includes('innerHTML'));
  const html = fs.readFileSync(path.join(__dirname, '../templates/admin.html'), 'utf8');
  assert.match(html, /id="admin-app"[^>]*hidden/);
  assert.match(html, /id="admin-password"[^>]*type="password"/);
  assert.match(html, /@supabase\/supabase-js@2\.118\.0/);
});
