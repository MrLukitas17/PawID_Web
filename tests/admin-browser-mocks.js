// Exclusivamente QA local. Ninguna petición ni mutación se envía a Supabase.
(function () {
  const photo = 'data:image/png;base64,__ADMIN_TEST_PHOTO__';
  const ADMIN = '00000000-0000-4000-8000-000000000001';
  const USER = '00000000-0000-4000-8000-000000000002';
  const makeId = number => '10000000-0000-4000-8000-' + String(number).padStart(12, '0');
  const owner = {id: USER, nombre: 'Ana Pérez', email: 'ana@example.test'};
  const mock = window.adminTest = {
    calls: [], logouts: [], options: null, allowed: true, failAction: null, failNext: false,
    malformedDashboard: false, delay: 12, logoutDelay: 0, loginPending: false,
    users: Array.from({length: 26}, (_, index) => ({id: makeId(index + 1),
      nombre: index === 0 ? 'Ana Pérez' : 'Usuario de PawID ' + (index + 1),
      email: index === 0 ? owner.email : 'usuario' + (index + 1) + '@example.test',
      telefono: '912345678', proveedor: index % 3 ? 'email' : 'google', foto_path: '',
      foto_google: '', created_at: '2026-10-15T12:00:00Z', password: 'CAMPO_QUE_NO_DEBE_RENDERIZARSE'})),
    pets: [{id: makeId(100), usuario_id: USER, nombre: 'Pluto', especie: 'Perro', raza: 'Mestizo',
      fecha_nacimiento: '2022-06-12', dueno_nombre: owner.nombre, dueno_telefono: '912345678',
      fotos: [photo, photo], foto_path: photo, peso_kg: 12, vacunas: 'Al día',
      descripcion: 'Compañero tranquilo y cariñoso.', created_at: '2026-10-01', responsable: owner}],
    adoptions: [{id: makeId(200), usuario_id: USER, nombre: 'Pluto busca una familia', especie: 'Perro',
      raza: 'Mestizo', edad: '4 años', fotos: [photo, photo], foto_mascota: photo,
      descripcion: 'Un compañero cariñoso que busca un hogar responsable. Disfruta de los paseos y de estar acompañado.',
      adoptado: false, comuna: 'Santiago', region: 'Metropolitana', telefono: '912345678',
      contacto: 'Ana', esterilizado: 'Sí', vacunas: 'Al día', tamano: 'Mediano', responsable: owner,
      created_at: '2026-10-15', updated_at: '2026-10-20'},
      {id: makeId(201), usuario_id: USER, nombre: 'Luna', especie: 'Gato', descripcion: 'Publicación finalizada.',
        adoptado: true, fotos: [], responsable: owner, created_at: '2026-10-01'}],
    homes: [{id: makeId(300), usuario_id: USER, nombre_hogar: 'Un hogar mientras espera', especie: 'Perros y gatos',
      'tamaño': 'Pequeño y mediano', disponibilidad: true, comuna: 'Ñuñoa', region: 'Metropolitana',
      descripcion: 'Un espacio tranquilo para acompañar su espera. Coordinación previa con el responsable.',
      telefono: '912345678', contacto: 'Ana', responsable: owner, created_at: '2026-10-15'},
      {id: makeId(301), nombre_hogar: 'Espacio sin disponibilidad', disponibilidad: false, responsable: null, created_at: '2026-10-10'}],
    articles: [{id: makeId(400), titulo: 'Pequeños cuidados, un gran bienestar',
      contenido: 'Agua fresca, paseos y compañía son parte de una vida juntos.\nCada mascota tiene necesidades diferentes.',
      imagen_url: photo, publicado: true, created_at: '2026-10-15', updated_at: '2026-10-20'},
      {id: makeId(401), titulo: 'Preparar una adopción responsable', contenido: 'Borrador de un nuevo artículo informativo.',
        imagen_url: null, publicado: false, created_at: '2026-10-20', updated_at: '2026-10-20'}]
  };
  function failure(status, text) {
    return {error: {context: new Response(JSON.stringify({error: text}), {status}), message: 'Mensaje interno no visible'}};
  }
  window.supabase = {createClient(_url, _key, options) {
    mock.options = options;
    const storage = options.auth.storage, key = options.auth.storageKey;
    let notify = () => {};
    const session = () => { try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; } };
    const auth = {
      async getSession() { return {data: {session: session()}, error: null}; },
      async signInWithPassword({email, password}) {
        mock.loginPending = true;
        await new Promise(resolve => setTimeout(resolve, mock.delay));
        mock.loginPending = false;
        if (password !== 'prueba-local') return {error: {message: 'Error interno Auth'}};
        const normal = email === 'normal@example.test';
        const value = {access_token: normal ? 'mock-normal-jwt' : 'mock-admin-jwt',
          user: {id: normal ? USER : ADMIN, email}};
        storage.setItem(key, JSON.stringify(value)); notify('SIGNED_IN', value);
        return {data: {session: value}, error: null};
      },
      async signOut(value) {
        mock.logouts.push(value);
        if (mock.logoutDelay) await new Promise(resolve => setTimeout(resolve, mock.logoutDelay));
        storage.removeItem(key); notify('SIGNED_OUT', null); return {error: null};
      },
      onAuthStateChange(callback) { notify = callback; return {data: {subscription: {unsubscribe() {}}}}; }
    };
    return {auth, functions: {async invoke(name, options) {
      mock.calls.push({name, body: structuredClone(options.body), authorization: options.headers.Authorization});
      await new Promise(resolve => setTimeout(resolve, mock.delay));
      if (name !== 'pawid-admin') throw new Error('Función incorrecta en el frontend.');
      if (options.headers.Authorization !== 'Bearer mock-admin-jwt' || !mock.allowed) return failure(403, 'No eres administrador.');
      if (mock.failNext || mock.failAction === options.body.action) {
        mock.failNext = false; return failure(500, 'No se pudo cargar la información de prueba.');
      }
      const body = options.body;
      if (body.action === 'dashboard') return {data: {ok: true,
        administrador: {auth_user_id: mock.malformedDashboard ? USER : ADMIN, email: session()?.user.email},
        estadisticas: {usuarios: mock.users.length, mascotas: mock.pets.length,
          adopciones: {total: mock.adoptions.length, activas: mock.adoptions.filter(row => !row.adoptado).length, inactivas: mock.adoptions.filter(row => row.adoptado).length},
          hogares: {total: mock.homes.length, disponibles: mock.homes.filter(row => row.disponibilidad === true).length, no_disponibles: mock.homes.filter(row => row.disponibilidad === false).length, sin_estado: 0},
          articulos: {total: mock.articles.length, publicados: mock.articles.filter(row => row.publicado).length, borradores: mock.articles.filter(row => !row.publicado).length}}}};
      const lists = {listar_usuarios: mock.users, listar_mascotas: mock.pets, listar_adopciones: mock.adoptions,
        listar_hogares: mock.homes, listar_articulos: mock.articles};
      if (Object.hasOwn(lists, body.action)) {
        let rows = lists[body.action];
        if (body.busqueda) rows = rows.filter(row => [row.nombre, row.email].some(value => value.toLowerCase().includes(body.busqueda.toLowerCase())));
        const start = (body.pagina - 1) * body.tamano_pagina;
        return {data: {ok: true, items: structuredClone(rows.slice(start, start + body.tamano_pagina)),
          total: rows.length, pagina: body.pagina, tamano_pagina: body.tamano_pagina}};
      }
      const deleteLists = {eliminar_adopcion: mock.adoptions, eliminar_hogar: mock.homes, eliminar_articulo: mock.articles};
      if (Object.hasOwn(deleteLists, body.action)) {
        if (body.confirmar !== true) return failure(400, 'Falta confirmación.');
        const list = deleteLists[body.action], index = list.findIndex(row => row.id === body.id);
        if (index < 0) return failure(404, 'No existe el registro.');
        list.splice(index, 1); return {data: {ok: true, id: body.id}};
      }
      if (body.action === 'crear_articulo') {
        const article = {id: makeId(500 + mock.articles.length), ...body.articulo, created_at: '2026-11-03', updated_at: '2026-11-03'};
        mock.articles.unshift(article); return {data: {ok: true, articulo: structuredClone(article)}};
      }
      if (body.action === 'editar_articulo') {
        const article = mock.articles.find(row => row.id === body.id);
        Object.assign(article, body.articulo, {updated_at: '2026-11-03'});
        return {data: {ok: true, articulo: structuredClone(article)}};
      }
      throw new Error('Acción no esperada en la prueba.');
    }}};
  }};
})();
