// Pruebas locales sin red, credenciales reales ni cambios en Supabase.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const handlerSource = fs.readFileSync(path.join(root, 'supabase/functions/pawid-admin/handler.js'), 'utf8');
const loadHandler = import('data:text/javascript;base64,' + Buffer.from(handlerSource).toString('base64'));
const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000002';
const PET_ID = '00000000-0000-4000-8000-000000000003';
const ADOPTION_ID = '00000000-0000-4000-8000-000000000004';
const HOME_ID = '00000000-0000-4000-8000-000000000005';
const ARTICLE_ID = '00000000-0000-4000-8000-000000000006';
const SECRET = 'DATO_SECRETO_QUE_NO_DEBE_SALIR';
const ORIGIN = 'http://localhost:5500';
const DEV_ORIGINS = [ORIGIN, 'http://127.0.0.1:5500'];
const actions = ['dashboard', 'listar_usuarios', 'listar_mascotas', 'listar_adopciones',
  'eliminar_adopcion', 'listar_hogares', 'eliminar_hogar', 'listar_articulos',
  'crear_articulo', 'editar_articulo', 'eliminar_articulo'];

function fixture() {
  const leaks = {password: SECRET, password_hash: SECRET, token: SECRET, recovery_code: SECRET};
  const created_at = '2026-01-01T00:00:00Z';
  return {
    pawid_admins: [{auth_user_id: ADMIN_ID}],
    usuarios: [{id: USER_ID, nombre: 'Ana Pérez', email: 'ana@example.test', telefono: '912345678',
      proveedor: 'email', created_at, ...leaks}],
    mascotas: [{id: PET_ID, usuario_id: USER_ID, nombre: 'Luna', especie: 'Perro', raza: 'Mestiza',
      fotos: ['https://example.test/luna.jpg', {password: SECRET}], created_at, ...leaks}],
    publicacion_adopcion: [{id: ADOPTION_ID, usuario_id: USER_ID, mascota_id: PET_ID,
      nombre: 'Luna', adoptado: false, created_at, ...leaks}],
    publicaciones_hogares__temporales: [{id: HOME_ID, usuario_id: USER_ID, nombre_hogar: 'Acogida',
      disponibilidad: true, created_at, ...leaks}],
    articulos_sitio: [{id: ARTICLE_ID, titulo: 'Cuidado diario', contenido: 'Contenido informativo.',
      imagen_url: 'https://example.test/articulo.jpg', publicado: false, created_at, updated_at: created_at, ...leaks}]
  };
}

class Query {
  constructor(state, table) {
    this.state = state; this.table = table; this.mode = 'select'; this.filters = []; this.orders = [];
  }
  select(columns, options = {}) { this.columns = columns; this.options = options; return this; }
  eq(field, value) { this.filters.push(row => row[field] === value); return this; }
  order(field, options) { this.orders.push([field, options.ascending]); return this; }
  range(start, end) { this.window = [start, end]; return this; }
  maybeSingle() { this.singleRow = true; return this; }
  single() { this.singleRow = true; this.required = true; return this; }
  insert(values) { this.mode = 'insert'; this.values = values; return this; }
  update(values) { this.mode = 'update'; this.values = values; return this; }
  delete() { this.mode = 'delete'; return this; }
  or(expression) { this.search = expression; return this; }
  then(resolve, reject) { return Promise.resolve().then(() => this.execute()).then(resolve, reject); }
  execute() {
    const {state, table} = this;
    state.queries.push({table, mode: this.mode, columns: this.columns, search: this.search, values: this.values});
    assert.ok(Object.hasOwn(state.rows, table), 'No se consulta una tabla fuera del alcance.');
    if (state.failTables.has(table)) return {error: {message: SECRET, details: SECRET}};
    let rows = state.rows[table].filter(row => this.filters.every(filter => filter(row)));
    if (this.search) {
      const matched = /^nombre\.ilike\.%(.+)%,email\.ilike\.%(.+)%$/.exec(this.search);
      assert.ok(matched, 'Solo se permite el filtro cerrado de nombre/correo.');
      assert.equal(matched[1], matched[2]);
      const term = matched[1].replace(/\\_/g, '_').toLocaleLowerCase();
      rows = rows.filter(row => [row.nombre, row.email].some(value => value.toLocaleLowerCase().includes(term)));
    }
    if (this.mode === 'delete') state.rows[table] = state.rows[table].filter(row => !rows.includes(row));
    if (this.mode === 'update') rows.forEach(row => Object.assign(row, this.values));
    if (this.mode === 'insert') {
      const added = {id: ARTICLE_ID, created_at: '2026-01-01', updated_at: '2026-01-01', ...this.values};
      state.rows[table].push(added); rows = [added];
    }
    const count = rows.length;
    rows = [...rows].sort((a, b) => {
      for (const [field, ascending] of this.orders) {
        const compare = String(a[field]).localeCompare(String(b[field]));
        if (compare) return ascending ? compare : -compare;
      }
      return 0;
    });
    if (this.window) rows = rows.slice(this.window[0], this.window[1] + 1);
    // La simulación devuelve columnas extra deliberadamente para probar la lista de salida.
    rows = rows.map(row => ({...row, responsable: state.rows.usuarios.find(user => user.id === row.usuario_id) || null}));
    if (this.required && rows.length !== 1) return {error: {message: SECRET}};
    return {data: this.options?.head ? null : this.singleRow ? rows[0] || null : rows,
      count: this.options?.count === 'exact' ? count : null, error: null};
  }
}

async function setup({allowedOrigins = DEV_ORIGINS} = {}) {
  const state = {rows: fixture(), queries: [], authCalls: [], failTables: new Set(), authError: false};
  const admin = {
    auth: {getUser: async token => {
      state.authCalls.push(token);
      if (state.authError) throw new Error(SECRET);
      if (!['admin-jwt', 'normal-jwt', 'anonymous-jwt'].includes(token)) return {data: {user: null}, error: {message: SECRET}};
      return {data: {user: {
        id: token === 'normal-jwt' ? USER_ID : ADMIN_ID,
        // Una cuenta no administradora intenta aparentar ser admin con correo y metadata.
        email: 'admin@example.test', is_anonymous: token === 'anonymous-jwt',
        user_metadata: {role: 'admin', password: SECRET}, app_metadata: {extra: SECRET}
      }}, error: null};
    }},
    from: table => new Query(state, table)
  };
  const {createAdminHandler} = await loadHandler;
  const handler = createAdminHandler({admin, allowedOrigins, now: () => Date.parse('2026-11-03T12:00:00Z')});
  const call = async (body, options = {}) => {
    const headers = new Headers({'content-type': 'application/json', origin: ORIGIN});
    if (options.token !== null) headers.set('authorization', 'Bearer ' + (options.token || 'admin-jwt'));
    for (const [key, value] of Object.entries(options.headers || {})) {
      if (value === null) headers.delete(key);
      else headers.set(key, value);
    }
    const method = options.method || 'POST';
    const request = new Request('http://localhost/functions/v1/pawid-admin', {
      method, headers, ...(method === 'GET' ? {} : {body: options.raw ?? JSON.stringify(body)})
    });
    const response = await handler(request);
    const text = await response.text();
    assert.ok(!text.includes(SECRET), 'La respuesta no contiene secretos.');
    return {status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers};
  };
  return {state, call, admin};
}

function onlyMembership(state) {
  assert.ok(state.queries.every(query => query.table === 'pawid_admins'), 'No se opera sobre datos antes de autorizar.');
}

test('Las once acciones rechazan una petición sin JWT antes de consultar datos', async () => {
  const {state, call} = await setup();
  for (const action of actions) assert.equal((await call({action}, {token: null})).status, 401);
  assert.equal(state.authCalls.length, 0); assert.equal(state.queries.length, 0);
});

test('Las once acciones rechazan a una cuenta normal aunque su correo y metadata aparenten ser admin', async () => {
  const {state, call} = await setup();
  for (const action of actions) assert.equal((await call({action}, {token: 'normal-jwt'})).status, 403);
  assert.equal(state.authCalls.length, 11); onlyMembership(state);
});

test('Tokens inválidos, vencidos o claves públicas no sustituyen al JWT Auth', async () => {
  const {state, call} = await setup();
  for (const token of ['invalid', 'expired', 'sb_publishable_example']) {
    assert.equal((await call({action: 'dashboard'}, {token})).status, 401);
  }
  assert.equal(state.queries.length, 0);
});

test('Un token anónimo no obtiene permiso administrativo', async () => {
  const {state, call} = await setup();
  assert.equal((await call({action: 'dashboard'}, {token: 'anonymous-jwt'})).status, 401);
  assert.equal(state.queries.length, 0);
});

test('JWT y pertenencia a pawid_admins se revisan de nuevo en cada operación', async () => {
  const {state, call} = await setup();
  assert.equal((await call({action: 'listar_usuarios'})).status, 200);
  state.rows.pawid_admins = []; state.queries = [];
  assert.equal((await call({action: 'listar_mascotas'})).status, 403);
  assert.equal(state.authCalls.length, 2); onlyMembership(state);
});

test('Un fallo de la comprobación de rol deniega el acceso sin divulgar el error interno', async () => {
  const {state, call} = await setup(); state.failTables.add('pawid_admins');
  assert.equal((await call({action: 'listar_usuarios'})).status, 500); onlyMembership(state);
});

test('Un fallo de Auth nunca permite continuar a las tablas', async () => {
  const {state, call} = await setup(); state.authError = true;
  assert.equal((await call({action: 'dashboard'})).status, 500); assert.equal(state.queries.length, 0);
});

test('Las acciones adicionales, SQL y nombres heredados de Object son rechazados', async () => {
  const {state, call} = await setup();
  for (const action of ['sql', 'health', 'eliminar_usuario', 'toString', '__proto__', null]) {
    assert.equal((await call({action})).status, 400);
  }
  onlyMembership(state);
});

test('No admite tablas, columnas, consultas, tokens ni campos arbitrarios desde el frontend', async () => {
  const {state, call} = await setup();
  for (const extra of [{table: 'usuarios'}, {columns: 'password'}, {sql: 'SELECT 1'},
    {usuario_id: ADMIN_ID}, {token: 'another'}, {__test: true}]) {
    assert.equal((await call({action: 'listar_usuarios', ...extra})).status, 400);
  }
  onlyMembership(state);
});

test('Los orígenes ajenos se rechazan; OPTIONS no consulta información', async () => {
  const {state, call} = await setup();
  const denied = await call({action: 'dashboard'}, {headers: {origin: 'https://otro.test'}});
  assert.equal(denied.status, 403); assert.equal(denied.headers.get('access-control-allow-origin'), null);
  const preflight = await call({}, {method: 'OPTIONS', token: null});
  assert.equal(preflight.status, 204); assert.equal(state.authCalls.length, 0);
  assert.equal(preflight.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal(state.queries.length, 0);
});

test('Ambos orígenes de desarrollo reciben exclusivamente su propio Access-Control-Allow-Origin', async () => {
  const {call} = await setup();
  for (const origin of DEV_ORIGINS) {
    const result = await call({action: 'listar_usuarios'}, {headers: {origin}});
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('access-control-allow-origin'), origin);
    assert.equal(result.headers.get('vary'), 'Origin');
    const preflight = await call({}, {method: 'OPTIONS', token: null, headers: {origin}});
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.equal(preflight.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
  }
});

test('CORS permite un origen HTTPS agregado explícitamente y no otros dominios de Vercel', async () => {
  const production = 'https://pawid.example.test';
  const {call} = await setup({allowedOrigins: [...DEV_ORIGINS, production]});
  const result = await call({action: 'listar_usuarios'}, {headers: {origin: production}});
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('access-control-allow-origin'), production);
  for (const origin of ['https://otro.vercel.app', 'https://pawid-preview.vercel.app']) {
    const denied = await call({action: 'dashboard'}, {headers: {origin}});
    assert.equal(denied.status, 403); assert.equal(denied.headers.get('access-control-allow-origin'), null);
  }
});

test('La comparación de Origin es exacta y rechaza puertos, esquemas y valores ajenos', async () => {
  const {state, call} = await setup();
  for (const origin of ['http://localhost:5501', 'http://127.0.0.1:5501', 'https://localhost:5500',
    'http://localhost:5500.evil.test', 'http://localhost:5500/path', 'http://LOCALHOST:5500', 'null', '']) {
    for (const method of ['POST', 'OPTIONS']) {
      const denied = await call({action: 'listar_usuarios'}, {method, headers: {origin}});
      assert.equal(denied.status, 403);
      assert.equal(denied.headers.get('access-control-allow-origin'), null);
    }
  }
  assert.equal(state.authCalls.length, 0); assert.equal(state.queries.length, 0);
});

test('Una lista explícita no incorpora automáticamente los orígenes predeterminados', async () => {
  const production = 'https://pawid.example.test';
  const {call} = await setup({allowedOrigins: [production]});
  assert.equal((await call({action: 'listar_usuarios'}, {headers: {origin: ORIGIN}})).status, 403);
  assert.equal((await call({action: 'listar_usuarios'}, {headers: {origin: production}})).status, 200);
});

test('Sin Origin las once acciones siguen exigiendo JWT y membresía; no se emite cabecera CORS', async () => {
  const {call} = await setup();
  for (const action of actions) {
    for (const [token, status] of [[null, 401], ['invalid', 401], ['normal-jwt', 403]]) {
      const result = await call({action}, {token, headers: {origin: null}});
      assert.equal(result.status, status);
      assert.equal(result.headers.get('access-control-allow-origin'), null);
    }
  }
  const result = await call({action: 'listar_usuarios'}, {headers: {origin: null}});
  assert.equal(result.status, 200); assert.equal(result.headers.get('access-control-allow-origin'), null);
});

test('OPTIONS sin Origin también requiere JWT y pawid_admins', async () => {
  const {state, call} = await setup();
  for (const [token, status] of [[null, 401], ['normal-jwt', 403], ['admin-jwt', 204]]) {
    const result = await call({}, {method: 'OPTIONS', token, headers: {origin: null}});
    assert.equal(result.status, status);
    assert.equal(result.headers.get('access-control-allow-origin'), null);
  }
  onlyMembership(state);
});

test('Las respuestas de error reflejan únicamente un Origin autorizado', async () => {
  const {state, call} = await setup();
  const unauthenticated = await call({action: 'dashboard'}, {token: null, headers: {origin: DEV_ORIGINS[1]}});
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.headers.get('access-control-allow-origin'), DEV_ORIGINS[1]);
  state.failTables.add('usuarios');
  const failed = await call({action: 'listar_usuarios'}, {headers: {origin: null}});
  assert.equal(failed.status, 500); assert.equal(failed.headers.get('access-control-allow-origin'), null);
});

test('Peticiones concurrentes no comparten ni filtran cabeceras de otros orígenes', async () => {
  const {call} = await setup();
  const requested = Array.from({length: 24}, (_, index) => [...DEV_ORIGINS, null, 'https://otro.vercel.app'][index % 4]);
  const responses = await Promise.all(requested.map(origin => call({action: 'listar_usuarios'}, {headers: {origin}})));
  responses.forEach((result, index) => {
    const origin = requested[index];
    assert.equal(result.status, origin === 'https://otro.vercel.app' ? 403 : 200);
    assert.equal(result.headers.get('access-control-allow-origin'), DEV_ORIGINS.includes(origin) ? origin : null);
  });
});

test('CORS rechaza configuraciones vacías, comodines, rutas y credenciales', async () => {
  const {createAdminHandler} = await loadHandler;
  for (const allowedOrigins of [undefined, [], [''], ['*'], ['https://*.vercel.app'], ['null'],
    ['https://example.test/'], ['https://example.test/path'], ['https://example.test?query=1'],
    ['https://example.test#fragment'], ['https://user:password@example.test'], [ORIGIN, '']]) {
    assert.throws(() => createAdminHandler({admin: {}, allowedOrigins}), /PAWID_ADMIN_ORIGINS/);
  }
});

test('Solo admite POST JSON y no almacena en caché las respuestas', async () => {
  const {call} = await setup();
  assert.equal((await call({}, {method: 'GET'})).status, 405);
  assert.equal((await call({}, {headers: {'content-type': 'text/plain'}})).status, 415);
  const result = await call({action: 'listar_usuarios'});
  assert.equal(result.headers.get('cache-control'), 'no-store');
});

test('JSON inválido y cuerpos que no son objetos no ejecutan acciones', async () => {
  const {state, call} = await setup();
  assert.equal((await call({}, {raw: '{'})).status, 400);
  for (const body of [null, [], 'dashboard', 1]) assert.equal((await call(body)).status, 400);
  onlyMembership(state);
});

test('El límite de tamaño se aplica incluso sin Content-Length', async () => {
  const {state, call} = await setup();
  assert.equal((await call({}, {raw: ' '.repeat(128 * 1024 + 1)})).status, 413);
  assert.equal((await call({}, {headers: {'content-length': '200000'}})).status, 413);
  onlyMembership(state);
});

test('Dashboard cuenta perfiles, mascotas y estados sin devolver registros privados', async () => {
  const {state, call} = await setup();
  state.rows.publicaciones_hogares__temporales.push({id: USER_ID, disponibilidad: null});
  const result = await call({action: 'dashboard'});
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.estadisticas, {
    usuarios: 1, mascotas: 1, adopciones: {total: 1, activas: 1, inactivas: 0},
    hogares: {total: 2, disponibles: 1, no_disponibles: 0, sin_estado: 1},
    articulos: {total: 1, publicados: 0, borradores: 1}
  });
  assert.deepEqual(Object.keys(result.body.administrador).sort(), ['auth_user_id', 'email']);
});

test('Todos los listados funcionan con columnas explícitas y sin credenciales en las respuestas', async () => {
  const {state, call} = await setup();
  for (const action of actions.filter(value => value.startsWith('listar_'))) {
    const result = await call({action});
    assert.equal(result.status, 200); assert.equal(result.body.total, 1);
    assert.equal(result.body.items.length, 1);
    assert.ok(!Object.hasOwn(result.body.items[0], 'password'));
  }
  for (const query of state.queries) {
    assert.ok(!query.columns.includes('*'));
    assert.ok(!/password|hash|token|recovery|session/i.test(query.columns));
  }
});

test('Los responsables usan el usuario relacionado y una lista reducida de campos', async () => {
  const {call} = await setup();
  for (const action of ['listar_mascotas', 'listar_adopciones', 'listar_hogares']) {
    const result = await call({action});
    assert.deepEqual(result.body.items[0].responsable, {id: USER_ID, nombre: 'Ana Pérez', email: 'ana@example.test'});
  }
  const pet = (await call({action: 'listar_mascotas'})).body.items[0];
  assert.deepEqual(pet.fotos, ['https://example.test/luna.jpg']);
});

test('Los registros sin responsable siguen visibles sin inventar una asociación', async () => {
  const {state, call} = await setup(); state.rows.mascotas[0].usuario_id = null;
  assert.equal((await call({action: 'listar_mascotas'})).body.items[0].responsable, null);
});

test('La paginación conserva total y orden, y admite páginas vacías', async () => {
  const {state, call} = await setup();
  state.rows.usuarios.push({...state.rows.usuarios[0], id: ADMIN_ID, nombre: 'Beto'});
  const second = await call({action: 'listar_usuarios', pagina: 2, tamano_pagina: 1});
  assert.equal(second.body.total, 2); assert.equal(second.body.items[0].id, USER_ID);
  assert.deepEqual((await call({action: 'listar_usuarios', pagina: 3})).body.items, []);
});

test('Páginas y tamaños inválidos no ejecutan consultas de listado', async () => {
  const {state, call} = await setup();
  for (const extra of [{pagina: 0}, {pagina: '1'}, {pagina: 1.5}, {pagina: 1000001},
    {tamano_pagina: 0}, {tamano_pagina: 101}, {tamano_pagina: '25'}]) {
    assert.equal((await call({action: 'listar_usuarios', ...extra})).status, 400);
  }
  onlyMembership(state);
});

test('La búsqueda admite nombre/correo y rechaza sintaxis de consultas PostgREST', async () => {
  const {call} = await setup();
  for (const busqueda of ['Pérez', 'ana@example.test']) {
    assert.equal((await call({action: 'listar_usuarios', busqueda})).body.items.length, 1);
  }
  assert.equal((await call({action: 'listar_usuarios', busqueda: 'ausente'})).body.total, 0);
  for (const busqueda of ['x,email.neq.null', 'or(id.eq.1)', 'x%_', '"x"', {sql: true}]) {
    assert.equal((await call({action: 'listar_usuarios', busqueda})).status, 400);
  }
});

test('Los errores de datos se convierten en un mensaje genérico sin divulgar secretos', async () => {
  const {state, call} = await setup(); state.failTables.add('usuarios');
  const result = await call({action: 'listar_usuarios'});
  assert.equal(result.status, 500);
  assert.equal(result.body.error, 'No se pudo completar la operación administrativa.');
});

test('Las tres eliminaciones requieren confirmación booleana explícita', async () => {
  const {state, call} = await setup();
  for (const [action, id] of [['eliminar_adopcion', ADOPTION_ID], ['eliminar_hogar', HOME_ID], ['eliminar_articulo', ARTICLE_ID]]) {
    for (const confirmar of [undefined, false, 'true', 1]) {
      assert.equal((await call({action, id, confirmar})).status, 400);
    }
  }
  assert.ok(state.queries.every(query => query.mode === 'select'));
});

test('Eliminar una adopción solo borra esa publicación, conservando mascota y propietario', async () => {
  const {state, call} = await setup();
  const result = await call({action: 'eliminar_adopcion', id: ADOPTION_ID, confirmar: true});
  assert.equal(result.status, 200); assert.equal(result.body.id, ADOPTION_ID);
  assert.equal(state.rows.publicacion_adopcion.length, 0);
  assert.equal(state.rows.mascotas.length, 1); assert.equal(state.rows.usuarios.length, 1);
});

test('Eliminar un hogar solo borra el hogar indicado', async () => {
  const {state, call} = await setup();
  assert.equal((await call({action: 'eliminar_hogar', id: HOME_ID, confirmar: true})).status, 200);
  assert.equal(state.rows.publicaciones_hogares__temporales.length, 0);
  assert.equal(state.rows.publicacion_adopcion.length, 1); assert.equal(state.rows.usuarios.length, 1);
});

test('IDs inválidos o inexistentes no causan eliminaciones amplias', async () => {
  const {state, call} = await setup();
  for (const id of [undefined, '', '*', 'id.eq.1', {}, [ADOPTION_ID]]) {
    assert.equal((await call({action: 'eliminar_adopcion', id, confirmar: true})).status, 400);
  }
  assert.equal((await call({action: 'eliminar_adopcion', id: USER_ID, confirmar: true})).status, 404);
  assert.equal(state.rows.publicacion_adopcion.length, 1);
});

test('Crear artículo guarda imagen opcional y empieza como borrador por defecto', async () => {
  const {state, call} = await setup();
  const result = await call({action: 'crear_articulo', articulo: {titulo: ' Nuevo ', contenido: ' Texto ',
    imagen_url: 'https://example.test/nueva.jpg'}});
  assert.equal(result.status, 201); assert.equal(result.body.articulo.publicado, false);
  assert.equal(result.body.articulo.titulo, 'Nuevo');
  assert.equal(result.body.articulo.imagen_url, 'https://example.test/nueva.jpg');
  assert.equal(state.rows.articulos_sitio.length, 2);
});

test('Se puede crear un artículo sin imagen y publicarlo explícitamente', async () => {
  const {call} = await setup();
  const result = await call({action: 'crear_articulo', articulo: {titulo: 'Título', contenido: 'Texto', publicado: true}});
  assert.equal(result.status, 201); assert.equal(result.body.articulo.imagen_url, null);
  assert.equal(result.body.articulo.publicado, true);
});

test('Editar artículo cambia solo los campos enviados y actualiza la fecha en el servidor', async () => {
  const {call} = await setup();
  const result = await call({action: 'editar_articulo', id: ARTICLE_ID, articulo: {titulo: 'Título revisado'}});
  assert.equal(result.status, 200); assert.equal(result.body.articulo.contenido, 'Contenido informativo.');
  assert.equal(result.body.articulo.imagen_url, 'https://example.test/articulo.jpg');
  assert.equal(result.body.articulo.updated_at, '2026-11-03T12:00:00.000Z');
  assert.equal((await call({action: 'editar_articulo', id: ARTICLE_ID, articulo: {imagen_url: null}})).body.articulo.imagen_url, null);
  assert.equal((await call({action: 'editar_articulo', id: USER_ID, articulo: {titulo: 'Ausente'}})).status, 404);
});

test('Los artículos rechazan campos arbitrarios, valores vacíos, estados y tamaños inválidos', async () => {
  const {state, call} = await setup();
  for (const articulo of [null, [], {}, {titulo: 'Solo título'}, {titulo: '', contenido: 'Texto'},
    {titulo: 'x'.repeat(181), contenido: 'Texto'}, {titulo: 'Título', contenido: 'x'.repeat(30001)},
    {titulo: 'Título', contenido: 'Texto', publicado: 'true'},
    {titulo: 'Título', contenido: 'Texto', password: 'x'},
    {titulo: 'Título', contenido: 'Texto', id: USER_ID},
    {titulo: 'Título', contenido: 'Texto', updated_at: '2000-01-01'}]) {
    assert.equal((await call({action: 'crear_articulo', articulo})).status, 400);
  }
  assert.equal((await call({action: 'editar_articulo', id: ARTICLE_ID, articulo: {}})).status, 400);
  assert.ok(state.queries.every(query => query.mode === 'select'));
});

test('Las imágenes rechazan protocolos ejecutables, URLs relativas y credenciales', async () => {
  const {call} = await setup();
  for (const imagen_url of ['javascript:alert(1)', 'data:image/png;base64,aaa', '/imagen.jpg',
    'https://user:password@example.test/img.png', 123]) {
    assert.equal((await call({action: 'crear_articulo', articulo: {titulo: 'Título', contenido: 'Texto', imagen_url}})).status, 400);
  }
});

test('Eliminar un artículo confirmado no opera en otras tablas', async () => {
  const {state, call} = await setup();
  assert.equal((await call({action: 'eliminar_articulo', id: ARTICLE_ID, confirmar: true})).status, 200);
  assert.equal(state.rows.articulos_sitio.length, 0); assert.equal(state.rows.usuarios.length, 1);
});

test('La entrada Deno y la copia para Dashboard usan el mismo handler y la clave solo como variable de servidor', async () => {
  const {admin} = await setup();
  const entry = fs.readFileSync(path.join(root, 'supabase/functions/pawid-admin/index.ts'), 'utf8');
  const bundle = fs.readFileSync(path.join(root, 'supabase/dashboard/pawid-admin.ts'), 'utf8');
  function boot(origins) {
    let served;
    const context = vm.createContext({
    URL, Response, TextDecoder,
    createClient: (url, key, options) => {
      assert.equal(url, 'https://example.test'); assert.equal(key, SECRET);
      assert.equal(options.auth.persistSession, false);
      assert.equal(options.auth.autoRefreshToken, false);
      return admin;
    },
    Deno: {env: {get: key => ({SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: SECRET,
      PAWID_ADMIN_ORIGINS: origins})[key]}, serve: handler => { served = handler; }}
    });
    const withoutImports = bundle.replace(/^import .*;\r?\n/gm, '');
    new vm.Script(withoutImports).runInContext(context);
    assert.equal(typeof served, 'function');
    return served;
  }
  assert.ok(entry.includes('@supabase/supabase-js@2.118.0'));
  assert.ok(bundle.includes(handlerSource.replace('export function createAdminHandler', 'function createAdminHandler')));
  assert.ok(!bundle.includes("from './handler.js'"));
  // Se verifica la lectura de la variable, espacios entre entradas y valores predeterminados.
  for (const origins of [DEV_ORIGINS.join(', '), undefined]) {
    const served = boot(origins);
    for (const origin of DEV_ORIGINS) {
      const response = await served(new Request('http://localhost/functions/v1/pawid-admin', {
        method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer admin-jwt', origin},
        body: JSON.stringify({action: 'listar_usuarios'})
      }));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      assert.ok(!(await response.text()).includes(SECRET));
    }
  }
  for (const invalid of ['', ' ', '*', DEV_ORIGINS.join(',') + ',']) {
    assert.throws(() => boot(invalid), /PAWID_ADMIN_ORIGINS/);
  }
  const config = fs.readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');
  assert.match(config, /\[functions\.pawid-admin\]\s*verify_jwt = true/);
});
