// @ts-nocheck
// Generado por scripts/Preparar-Admin.ps1. NO desplegado.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
// API administrativa independiente. Ninguna tabla o columna procede de la petición.
const USER_FIELDS = ['id', 'nombre', 'email', 'telefono', 'foto_path', 'foto_google', 'proveedor', 'created_at'];
const OWNER_FIELDS = ['id', 'nombre', 'email'];
const PET_FIELDS = ['id', 'usuario_id', 'nombre', 'especie', 'raza', 'fecha_nacimiento',
  'dueno_nombre', 'dueno_telefono', 'foto_path', 'fotos', 'peso_kg', 'vacunas', 'descripcion', 'created_at'];
const ADOPTION_FIELDS = ['id', 'usuario_id', 'mascota_id', 'nombre', 'descripcion', 'contacto',
  'region', 'comuna', 'foto_mascota', 'adoptado', 'fotos', 'especie', 'tamano', 'telefono',
  'raza', 'edad', 'esterilizado', 'vacunas', 'created_at', 'updated_at'];
const HOME_FIELDS = ['id', 'usuario_id', 'nombre_hogar', 'descripcion', 'especie', 'tamaño',
  'region', 'comuna', 'telefono', 'contacto', 'disponibilidad', 'created_at', 'updated_at'];
const ARTICLE_FIELDS = ['id', 'titulo', 'contenido', 'imagen_url', 'publicado', 'created_at', 'updated_at'];
const PAGE_FIELDS = ['pagina', 'tamano_pagina'];
const ACTION_FIELDS = Object.freeze({
  dashboard: [],
  listar_usuarios: [...PAGE_FIELDS, 'busqueda'],
  listar_mascotas: PAGE_FIELDS,
  listar_adopciones: PAGE_FIELDS,
  eliminar_adopcion: ['id', 'confirmar'],
  listar_hogares: PAGE_FIELDS,
  eliminar_hogar: ['id', 'confirmar'],
  listar_articulos: PAGE_FIELDS,
  crear_articulo: ['articulo'],
  editar_articulo: ['id', 'articulo'],
  eliminar_articulo: ['id', 'confirmar']
});
const MAX_BODY_BYTES = 128 * 1024;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => { throw new HttpError(status, message); };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function allowedFields(value, fields) {
  if (!isObject(value) || Object.keys(value).some(key => !fields.includes(key))) {
    fail(400, 'La solicitud contiene campos no permitidos.');
  }
}

// Segunda lista de salida: no se propagan columnas adicionales ni objetos Auth.
function expose(row, fields) {
  const result = {};
  for (const field of fields) {
    result[field] = row[field] ?? null;
    if (field === 'fotos') {
      result[field] = Array.isArray(row.fotos)
        ? row.fotos.filter(value => typeof value === 'string').slice(0, 8) : [];
    }
  }
  return result;
}

function pagination(body) {
  const page = body.pagina ?? 1;
  const size = body.tamano_pagina ?? 25;
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 ||
      !Number.isSafeInteger(size) || size < 1 || size > 100) {
    fail(400, 'Indica una página válida y un tamaño de entre 1 y 100 registros.');
  }
  return {page, size, start: (page - 1) * size};
}

function recordId(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value)) {
    fail(400, 'El identificador debe ser un UUID válido.');
  }
  return value;
}

function articleValues(article, creating) {
  allowedFields(article, ['titulo', 'contenido', 'imagen_url', 'publicado']);
  if (Object.keys(article).length === 0) fail(400, 'Indica los datos del artículo.');
  const values = {};
  for (const [field, max] of [['titulo', 180], ['contenido', 30000]]) {
    if (creating || Object.hasOwn(article, field)) {
      const value = article[field];
      if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
        fail(400, `El campo ${field} es obligatorio y admite hasta ${max} caracteres.`);
      }
      values[field] = value.trim();
    }
  }
  if (Object.hasOwn(article, 'publicado')) {
    if (typeof article.publicado !== 'boolean') fail(400, 'El estado publicado debe ser verdadero o falso.');
    values.publicado = article.publicado;
  } else if (creating) values.publicado = false;
  if (Object.hasOwn(article, 'imagen_url')) {
    const value = article.imagen_url;
    if (value === null || value === '') values.imagen_url = null;
    else {
      if (typeof value !== 'string' || value.length > 2048) fail(400, 'La URL de imagen no es válida.');
      let url;
      try { url = new URL(value); } catch { fail(400, 'La URL de imagen debe ser una dirección HTTP o HTTPS absoluta.'); }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
        fail(400, 'La URL de imagen debe usar HTTP o HTTPS y no contener credenciales.');
      }
      values.imagen_url = url.href;
    }
  } else if (creating) values.imagen_url = null;
  return values;
}

async function readBody(req) {
  if (Number(req.headers.get('content-length')) > MAX_BODY_BYTES) fail(413, 'La solicitud es demasiado grande.');
  if (!req.body) fail(400, 'Envía una solicitud JSON.');
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let text = '', bytes = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        fail(413, 'La solicitud es demasiado grande.');
      }
      text += decoder.decode(value, {stream: true});
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  try { return JSON.parse(text); } catch { fail(400, 'El cuerpo de la solicitud debe ser JSON válido.'); }
}

function createAdminHandler({admin, allowedOrigins, now = () => Date.now()}) {
  if (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0) {
    throw new Error('PAWID_ADMIN_ORIGINS debe contener una lista explícita de orígenes HTTP o HTTPS.');
  }
  const origins = new Set(allowedOrigins.map(value => {
    let url;
    try { url = new URL(value); } catch { throw new Error('PAWID_ADMIN_ORIGINS contiene un origen no válido.'); }
    if (typeof value !== 'string' || value.includes('*') ||
        !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.origin !== value) {
      throw new Error('PAWID_ADMIN_ORIGINS solo admite orígenes exactos, sin rutas, credenciales ni comodines.');
    }
    return value;
  }));
  const baseHeaders = {
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin'
  };
  const run = async query => {
    const result = await query;
    if (result.error) throw new Error('Error interno de acceso a datos.');
    return result;
  };
  async function authorize(req) {
    const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') || '');
    if (!match) fail(401, 'Inicia sesión en el acceso de administración.');
    // getUser(jwt) verifica el token con Supabase Auth en CADA petición.
    const {data, error} = await admin.auth.getUser(match[1]);
    if (error || !data?.user?.id || data.user.is_anonymous === true) {
      fail(401, 'La sesión administrativa no es válida o ha vencido.');
    }
    // No se usan correo, user_metadata ni claims de rol como autorización.
    const membership = await run(admin.from('pawid_admins').select('auth_user_id')
      .eq('auth_user_id', data.user.id).maybeSingle());
    if (!membership.data || membership.data.auth_user_id !== data.user.id) {
      fail(403, 'Tu cuenta no tiene permiso de administrador.');
    }
    return {auth_user_id: data.user.id, email: data.user.email || ''};
  }
  async function list(query, fields, body, withOwner = false) {
    const {page, size, start} = pagination(body);
    const result = await run(query.order('created_at', {ascending: false})
      .order('id', {ascending: true}).range(start, start + size - 1));
    const items = result.data.map(row => {
      const item = expose(row, fields);
      if (withOwner) item.responsable = isObject(row.responsable) ? expose(row.responsable, OWNER_FIELDS) : null;
      return item;
    });
    return {items, pagina: page, tamano_pagina: size, total: result.count};
  }
  async function count(query) {
    const result = await run(query);
    if (!Number.isSafeInteger(result.count)) throw new Error('No fue posible obtener el total.');
    return result.count;
  }
  async function remove(query, id, confirmed) {
    if (confirmed !== true) fail(400, 'Confirma la eliminación antes de continuar.');
    const result = await run(query.eq('id', recordId(id)).select('id').maybeSingle());
    if (!result.data) fail(404, 'El registro ya no existe.');
    return {id: result.data.id};
  }
  const withOwner = (fields, foreignKey) =>
    `${fields.join(',')},responsable:usuarios!${foreignKey}(${OWNER_FIELDS.join(',')})`;

  return async req => {
    // Cabeceras por petición: nunca se comparte el Origin entre solicitudes concurrentes.
    const headers = {...baseHeaders};
    const reply = (body, status = 200) => new Response(JSON.stringify(body), {status, headers});
    try {
      const requestOrigin = req.headers.get('origin');
      if (requestOrigin !== null) {
        if (!origins.has(requestOrigin)) fail(403, 'Este origen no está autorizado.');
        headers['Access-Control-Allow-Origin'] = requestOrigin;
      }
      // El preflight de un origen permitido no consulta ni modifica información.
      // Sin Origin también exige JWT y membresía, incluso si el método es OPTIONS.
      if (req.method === 'OPTIONS') {
        if (requestOrigin === null) await authorize(req);
        return new Response(null, {status: 204, headers});
      }
      if (req.method !== 'POST') return new Response(JSON.stringify({ok: false, error: 'Utiliza POST.'}),
        {status: 405, headers: {...headers, Allow: 'POST, OPTIONS'}});
      if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        fail(415, 'Envía el cuerpo como application/json.');
      }
      const identity = await authorize(req);
      const body = await readBody(req);
      if (!isObject(body) || typeof body.action !== 'string' || !Object.hasOwn(ACTION_FIELDS, body.action)) {
        fail(400, 'La acción administrativa no está permitida.');
      }
      allowedFields(body, ['action', ...ACTION_FIELDS[body.action]]);
      let result;
      switch (body.action) {
        case 'dashboard': {
          const [users, pets, adoptions, adopted, pending, homes, available, unavailable, articles, published] =
            await Promise.all([
              count(admin.from('usuarios').select('id', {count: 'exact', head: true})),
              count(admin.from('mascotas').select('id', {count: 'exact', head: true})),
              count(admin.from('publicacion_adopcion').select('id', {count: 'exact', head: true})),
              count(admin.from('publicacion_adopcion').select('id', {count: 'exact', head: true}).eq('adoptado', true)),
              count(admin.from('publicacion_adopcion').select('id', {count: 'exact', head: true}).eq('adoptado', false)),
              count(admin.from('publicaciones_hogares__temporales').select('id', {count: 'exact', head: true})),
              count(admin.from('publicaciones_hogares__temporales').select('id', {count: 'exact', head: true}).eq('disponibilidad', true)),
              count(admin.from('publicaciones_hogares__temporales').select('id', {count: 'exact', head: true}).eq('disponibilidad', false)),
              count(admin.from('articulos_sitio').select('id', {count: 'exact', head: true})),
              count(admin.from('articulos_sitio').select('id', {count: 'exact', head: true}).eq('publicado', true))
            ]);
          result = {administrador: identity, estadisticas: {
            usuarios: users, mascotas: pets,
            adopciones: {total: adoptions, activas: pending, inactivas: adopted},
            hogares: {total: homes, disponibles: available, no_disponibles: unavailable,
              sin_estado: Math.max(0, homes - available - unavailable)},
            articulos: {total: articles, publicados: published, borradores: articles - published}
          }};
          break;
        }
        case 'listar_usuarios': {
          let query = admin.from('usuarios').select(USER_FIELDS.join(','), {count: 'exact'});
          if (body.busqueda !== undefined && body.busqueda !== '') {
            // Se excluye la sintaxis reservada de PostgREST. Nunca se acepta una expresión de filtro.
            if (typeof body.busqueda !== 'string' || body.busqueda.length > 100 ||
                !/^[\p{L}\p{N}\s@.+_\-]+$/u.test(body.busqueda)) {
              fail(400, 'La búsqueda admite hasta 100 caracteres de nombre o correo.');
            }
            const term = body.busqueda.trim().replace(/_/g, '\\_');
            if (term) query = query.or(`nombre.ilike.%${term}%,email.ilike.%${term}%`);
          }
          result = await list(query, USER_FIELDS, body);
          break;
        }
        case 'listar_mascotas':
          result = await list(admin.from('mascotas').select(withOwner(PET_FIELDS, 'mascotas_usuario_id_fkey'),
            {count: 'exact'}), PET_FIELDS, body, true);
          break;
        case 'listar_adopciones':
          result = await list(admin.from('publicacion_adopcion').select(withOwner(ADOPTION_FIELDS,
            'publicacion_adopcion_usuario_id_fkey'), {count: 'exact'}), ADOPTION_FIELDS, body, true);
          break;
        case 'eliminar_adopcion':
          result = await remove(admin.from('publicacion_adopcion').delete(), body.id, body.confirmar);
          break;
        case 'listar_hogares':
          result = await list(admin.from('publicaciones_hogares__temporales').select(withOwner(HOME_FIELDS,
            'publicaciones_hogares__temporales_usuario_id_fkey'), {count: 'exact'}), HOME_FIELDS, body, true);
          break;
        case 'eliminar_hogar':
          result = await remove(admin.from('publicaciones_hogares__temporales').delete(), body.id, body.confirmar);
          break;
        case 'listar_articulos':
          result = await list(admin.from('articulos_sitio').select(ARTICLE_FIELDS.join(','),
            {count: 'exact'}), ARTICLE_FIELDS, body);
          break;
        case 'crear_articulo': {
          const values = articleValues(body.articulo, true);
          const saved = await run(admin.from('articulos_sitio').insert(values).select(ARTICLE_FIELDS.join(',')).single());
          result = {articulo: expose(saved.data, ARTICLE_FIELDS)};
          break;
        }
        case 'editar_articulo': {
          const id = recordId(body.id);
          const values = articleValues(body.articulo, false);
          values.updated_at = new Date(now()).toISOString();
          const saved = await run(admin.from('articulos_sitio').update(values).eq('id', id)
            .select(ARTICLE_FIELDS.join(',')).maybeSingle());
          if (!saved.data) fail(404, 'El artículo ya no existe.');
          result = {articulo: expose(saved.data, ARTICLE_FIELDS)};
          break;
        }
        case 'eliminar_articulo':
          result = await remove(admin.from('articulos_sitio').delete(), body.id, body.confirmar);
          break;
      }
      return reply({ok: true, ...result}, body.action === 'crear_articulo' ? 201 : 200);
    } catch (error) {
      // Los mensajes internos de Supabase pueden contener datos: nunca se devuelven.
      if (error instanceof HttpError) return reply({ok: false, error: error.message}, error.status);
      return reply({ok: false, error: 'No se pudo completar la operación administrativa.'}, 500);
    }
  };
}


// Estos valores solo se leen en el servidor. No se envían al navegador.
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const allowedOrigins = (Deno.env.get('PAWID_ADMIN_ORIGINS') ??
  'http://localhost:5500,http://127.0.0.1:5500').split(',').map(origin => origin.trim());
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor.');
}

// El JWT recibido se pasa únicamente a getUser(). Nunca se instala como sesión
// ni como cabecera global de este cliente privilegiado, compartido entre peticiones.
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}
});

Deno.serve(createAdminHandler({admin, allowedOrigins}));
