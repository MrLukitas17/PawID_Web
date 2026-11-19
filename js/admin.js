(function () {
  'use strict';
  const STORAGE_KEY = 'pawid-admin-auth-v1';
  const ACTIONS = new Set(['dashboard', 'listar_adopciones',
    'eliminar_adopcion', 'listar_hogares', 'eliminar_hogar', 'listar_articulos',
    'crear_articulo', 'editar_articulo', 'eliminar_articulo']);

  function apiError(message, status = 0) { return Object.assign(new Error(message), {status}); }

  function createAPI(client, onAccessDenied = async () => {}) {
    async function session() {
      try {
        const {data, error} = await client.auth.getSession();
        if (error) throw new Error();
        return data?.session || null;
      } catch { throw apiError('No se pudo recuperar la sesión administrativa.', 401); }
    }
    return {
      session,
      async login(email, password) {
        try {
          const {data, error} = await client.auth.signInWithPassword({email: email.trim(), password});
          if (error || !data?.session?.access_token) throw new Error();
          return data.session;
        } catch {
          throw apiError('No se pudo iniciar sesión. Revisa el correo y la contraseña de tu cuenta administrativa.');
        }
      },
      logout: () => client.auth.signOut({scope: 'local'}),
      async call(action, params = {}) {
        if (!ACTIONS.has(action)) throw apiError('La acción administrativa no está permitida.', 400);
        try {
          const current = await session();
          if (!current?.access_token) throw apiError('Tu sesión venció. Inicia sesión nuevamente.', 401);
          let result;
          try {
            result = await client.functions.invoke('pawid-admin', {
              body: {...params, action}, headers: {Authorization: 'Bearer ' + current.access_token}
            });
          } catch { throw apiError('No se pudo conectar con la administración de PawID. Intenta nuevamente.'); }
          const {data, error} = result;
          if (error) {
            const status = error.context?.status || 0;
            let message = '';
            try {
              const response = error.context?.clone ? error.context.clone() : error.context;
              const payload = await response?.json();
              if (typeof payload?.error === 'string') message = payload.error.slice(0, 400);
            } catch { /* No se propagan mensajes internos del SDK. */ }
            if (status === 401) message = 'Tu sesión venció o no es válida. Inicia sesión nuevamente.';
            if (status === 403) message = 'Acceso denegado. No se pudo autorizar esta cuenta para administrar PawID.';
            throw apiError(message || 'No se pudo completar la solicitud. Revisa tu conexión e intenta nuevamente.', status);
          }
          if (!data || data.ok !== true) throw apiError('La administración devolvió una respuesta no válida. Intenta nuevamente.');
          return data;
        } catch (error) {
          if ([401, 403].includes(error.status)) await onAccessDenied(error.message);
          throw error;
        }
      }
    };
  }

  function imageURL(value, config, allowStoredPath = true) {
    if (typeof value !== 'string' || !value.trim()) return '';
    const text = value.trim();
    if (/^data:image\/(png|jpeg|webp|gif|avif);base64,[a-z\d+/=\s]+$/i.test(text)) return text;
    try {
      const url = new URL(text);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch {
      if (!allowStoredPath || /[:?#\\]/.test(text) || text.startsWith('/') || text.split('/').some(part => part === '..' || part === '.')) return '';
      return config.supabaseUrl.replace(/\/$/, '') + '/storage/v1/object/public/' +
        encodeURIComponent(config.bucket) + '/' + text.split('/').map(encodeURIComponent).join('/');
    }
  }

  function displayDate(value) {
    if (!value) return 'Sin información';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return value.split('-').reverse().join('/');
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('es-CL', {timeZone: 'America/Santiago'});
  }

  // Exportación solo para pruebas Node. En el navegador no se expone la sesión.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {createAPI, imageURL, displayDate, STORAGE_KEY};
    return;
  }

  const $ = selector => document.querySelector(selector);
  const all = selector => Array.from(document.querySelectorAll(selector));
  const SECTIONS = {
    dashboard: {title: 'Resumen general', description: 'Una mirada a las publicaciones de la comunidad.'},
    adopciones: {title: 'Adopciones', description: 'Revisa y modera las publicaciones de adopción.', action: 'listar_adopciones', noun: 'publicaciones'},
    hogares: {title: 'Hogares temporales', description: 'Consulta los espacios de acogida y su disponibilidad.', action: 'listar_hogares', noun: 'hogares'},
    articulos: {title: 'Artículos', description: 'Crea y mantén el contenido informativo del sitio.', action: 'listar_articulos', noun: 'artículos'}
  };
  const DELETE_ACTIONS = {adopciones: 'eliminar_adopcion', hogares: 'eliminar_hogar', articulos: 'eliminar_articulo'};
  const state = {authorized: false, identity: null, section: 'dashboard', page: 1, size: 12,
    total: 0, items: [], loading: false, epoch: 0, request: 0, loggingOut: false,
    pendingDelete: null, editing: null, deleting: false, saving: false};
  const config = window.PawIDConfig;
  let api, client;
  const initialSection = location.hash.slice(1);
  const fromMainLogin = window.PawIDAdminEntry?.prepareAdminLogin(document, location.search) === true;

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }
  function button(text, className, action) {
    const element = node('button', 'btn ' + className, text);
    element.type = 'button'; element.addEventListener('click', action); return element;
  }
  const valueText = value => value === null || value === undefined || value === '' ? 'Sin información' : String(value);
  const countText = value => Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString('es-CL') : '—';
  function message(element, text, error = false) {
    element.textContent = text || ''; element.hidden = !text;
    element.classList.toggle('error', error); element.dataset.kind = error ? 'error' : 'success';
    element.setAttribute('role', error ? 'alert' : 'status');
  }
  function feedback(text, error = false) { message($('#admin-feedback'), text, error); }
  function loginBusy(busy) {
    $('#admin-login-fields').disabled = busy;
    $('#admin-login-form').setAttribute('aria-busy', String(busy));
    $('#admin-login-submit').textContent = busy ? 'Verificando acceso…' : 'Ingresar al panel →';
  }
  function menu(open) {
    $('#admin-sidebar').dataset.open = String(open);
    $('#admin-menu-toggle').setAttribute('aria-expanded', String(open));
    $('#admin-menu-backdrop').hidden = !open;
  }
  function clearPrivate() {
    state.epoch++; state.request++;
    state.authorized = false; state.identity = null; state.items = []; state.total = 0;
    state.pendingDelete = null; state.editing = null; state.deleting = false; state.saving = false;
    state.page = 1; state.loading = false;
    all('dialog[open]').forEach(dialog => dialog.close());
    $('#admin-app').hidden = true; $('#admin-menu-toggle').hidden = true; menu(false);
    ['admin-loading', 'admin-load-error', 'admin-dashboard', 'admin-records-view', 'admin-pagination', 'admin-empty']
      .forEach(id => { $('#' + id).hidden = true; });
    $('#admin-load-error-text').textContent = '';
    $('#admin-records').replaceChildren(); $('#admin-detail-body').replaceChildren();
    $('#admin-detail-title').textContent = ''; $('#admin-confirm-description').textContent = '';
    $('#admin-account-email').textContent = ''; $('#admin-updated-at').textContent = '';
    $('#admin-record-count').textContent = ''; $('#admin-page-label').textContent = '';
    $('#admin-article-form').reset(); $('#admin-article-preview').removeAttribute('src');
    $('#admin-password').value = '';
    $('#admin-password').type = 'password'; $('#admin-password-toggle').textContent = 'Mostrar';
    $('#admin-password-toggle').setAttribute('aria-pressed', 'false');
    $('#admin-password-toggle').setAttribute('aria-label', 'Mostrar contraseña');
    all('[id^="stat-"]').filter(element => element.tagName === 'STRONG' || element.tagName === 'B')
      .forEach(element => { element.textContent = '—'; });
    feedback('');
  }
  function showLogin(text = '', error = false) {
    clearPrivate(); $('#admin-login').hidden = false;
    $('#admin-login-status').hidden = true; loginBusy(false);
    message($('#admin-login-message'), text, error);
    history.replaceState(null, '', location.pathname + location.search + '#login');
  }
  async function closeAdminSession() {
    try { return await api.logout(); }
    finally {
      // Solo se retira la caché de ESTA sesión oficial, nunca las claves del acceso normal.
      try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* Almacenamiento no disponible. */ }
    }
  }
  async function denyAccess(text) {
    showLogin(text, true);
    state.loggingOut = true; loginBusy(true);
    try { await closeAdminSession(); } catch { /* La interfaz ya quedó cerrada. */ }
    finally { state.loggingOut = false; loginBusy(false); }
  }
  async function checkedDashboard(result, expectedId) {
    if (!result?.administrador?.auth_user_id || result.administrador.auth_user_id !== expectedId || !result.estadisticas) {
      const text = 'Acceso denegado. No se pudo verificar la cuenta administrativa.';
      await denyAccess(text); throw apiError(text, 403);
    }
    return result;
  }
  function renderDashboard(data) {
    const stats = data.estadisticas;
    const values = {
      'stat-adoptions': stats.adopciones?.total, 'stat-adoptions-active': stats.adopciones?.activas,
      'stat-adoptions-inactive': stats.adopciones?.inactivas,
      'stat-homes': stats.hogares?.total, 'stat-homes-available': stats.hogares?.disponibles,
      'stat-homes-unavailable': stats.hogares?.no_disponibles, 'stat-homes-unknown': stats.hogares?.sin_estado,
      'stat-articles': stats.articulos?.total, 'stat-articles-published': stats.articulos?.publicados,
      'stat-articles-drafts': stats.articulos?.borradores
    };
    for (const [id, value] of Object.entries(values)) $('#' + id).textContent = countText(value);
    $('#stat-homes-unknown-wrap').hidden = !stats.hogares?.sin_estado;
    $('#admin-updated-at').textContent = 'Última actualización: ' + new Date().toLocaleTimeString('es-CL', {
      timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit'
    });
  }
  function loading(busy) {
    state.loading = busy; $('#admin-loading').hidden = !busy;
    $('.admin-workspace-heading').setAttribute('aria-busy', String(busy));
    $('#admin-records-view').setAttribute('aria-busy', String(busy));
    $('#admin-refresh').disabled = busy; $('#admin-page-size').disabled = busy;
    $('#admin-page-prev').disabled = busy || state.page <= 1;
    $('#admin-page-next').disabled = busy || state.page * state.size >= state.total;
  }
  async function authorize(section = 'dashboard') {
    const epoch = state.epoch;
    const session = await api.session();
    if (!session?.access_token) { showLogin(); return; }
    const result = await checkedDashboard(await api.call('dashboard'), session.user?.id);
    if (epoch !== state.epoch) return;
    state.identity = result.administrador; state.authorized = true;
    $('#admin-account-email').textContent = result.administrador.email;
    $('#admin-login').hidden = true; $('#admin-app').hidden = false;
    $('#admin-menu-toggle').hidden = false;
    await navigate(Object.hasOwn(SECTIONS, section) ? section : 'dashboard', result);
  }
  async function navigate(section, dashboardData) {
    if (!state.authorized || !Object.hasOwn(SECTIONS, section)) return;
    state.section = section; state.page = 1; state.items = [];
    menu(false); feedback('');
    all('.admin-nav [data-section]').forEach(element => {
      if (element.dataset.section === section) element.setAttribute('aria-current', 'page');
      else element.removeAttribute('aria-current');
    });
    $('#admin-section-title').textContent = SECTIONS[section].title;
    $('#admin-section-description').textContent = SECTIONS[section].description;
    $('#admin-new-article').hidden = section !== 'articulos';
    history.replaceState(null, '', location.pathname + location.search + '#' + section);
    await loadCurrent(dashboardData);
    if (state.authorized && state.section === section) $('#admin-section-title').focus({preventScroll: true});
  }
  async function loadCurrent(dashboardData) {
    if (!state.authorized) return;
    const epoch = state.epoch, request = ++state.request, section = state.section;
    $('#admin-dashboard').hidden = true; $('#admin-records-view').hidden = true;
    $('#admin-load-error').hidden = true; $('#admin-empty').hidden = true;
    $('#admin-records').replaceChildren(); $('#admin-pagination').hidden = true;
    loading(true);
    try {
      if (section === 'dashboard') {
        const result = await checkedDashboard(dashboardData || await api.call('dashboard'), state.identity.auth_user_id);
        if (epoch !== state.epoch || request !== state.request) return;
        renderDashboard(result); $('#admin-dashboard').hidden = false;
      } else {
        const params = {pagina: state.page, tamano_pagina: state.size};
        const result = await api.call(SECTIONS[section].action, params);
        if (epoch !== state.epoch || request !== state.request) return;
        state.items = Array.isArray(result.items) ? result.items : [];
        state.total = Number.isSafeInteger(result.total) ? result.total : state.items.length;
        $('#admin-records-view').hidden = false;
        renderRecords();
      }
    } catch (error) {
      if (epoch !== state.epoch || request !== state.request || !state.authorized) return;
      $('#admin-load-error-text').textContent = error.message || 'No se pudo cargar esta sección.';
      $('#admin-load-error').hidden = false;
    } finally {
      if (epoch === state.epoch && request === state.request) loading(false);
    }
  }

  function photos(row, section) {
    let images = [];
    if (section === 'adopciones') images = row.fotos?.length ? row.fotos : row.foto_mascota ? [row.foto_mascota] : [];
    if (section === 'articulos') images = row.imagen_url ? [row.imagen_url] : [];
    return images.map(url => imageURL(url, config, section !== 'articulos')).filter(Boolean).slice(0, 8);
  }
  function recordName(row, section) { return valueText(section === 'hogares' ? row.nombre_hogar : section === 'articulos' ? row.titulo : row.nombre); }
  function statusFor(row, section) {
    if (section === 'adopciones') return row.adoptado ? ['Inactiva · Adoptada', 'inactive'] : ['Activa · En adopción', 'active'];
    if (section === 'hogares') return row.disponibilidad === true ? ['Disponible', 'active'] : row.disponibilidad === false ? ['No disponible', 'inactive'] : ['Sin estado', 'draft'];
    if (section === 'articulos') return row.publicado ? ['Publicado', 'active'] : ['Borrador', 'draft'];
    return ['Solo lectura', 'inactive'];
  }
  function ownerName(row) { return row.responsable?.nombre || 'Sin responsable asociado'; }
  function imageElement(url, alt) {
    const image = node('img'); image.src = url; image.alt = alt;
    image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => { image.hidden = true; });
    return image;
  }
  function renderRecords() {
    const container = $('#admin-records'), section = state.section;
    container.replaceChildren(); container.className = '';
    const singular = {adopciones: 'publicación', hogares: 'hogar', articulos: 'artículo'};
    $('#admin-record-count').textContent = countText(state.total) + ' ' + (state.total === 1 ? singular[section] : SECTIONS[section].noun) + ' en total';
    if (!state.items.length) {
      $('#admin-empty-title').textContent = 'Todavía no hay ' + SECTIONS[section].noun;
      $('#admin-empty-description').textContent = section === 'articulos' ? 'Crea el primer artículo informativo de PawID.' : 'Los registros aparecerán aquí cuando estén disponibles.';
      $('#admin-empty').hidden = false;
    } else {
      container.className = 'admin-record-grid';
      state.items.forEach(row => {
        const card = node('article', 'admin-record-card'); card.dataset.recordId = row.id;
        if (section !== 'hogares') {
          const cover = node('div', 'admin-record-image'), urls = photos(row, section);
          if (urls.length) cover.append(imageElement(urls[0], recordName(row, section)));
          else { cover.textContent = '🐾'; cover.setAttribute('aria-label', 'Sin fotografía'); }
          card.append(cover);
        }
        const body = node('div', 'admin-record-body'), [status, statusClass] = statusFor(row, section);
        const badge = node('span', 'admin-status', status); badge.dataset.state = statusClass;
        body.append(badge, node('h2', '', recordName(row, section)));
        if (section === 'adopciones') body.append(node('p', '', [row.especie, row.raza, row.comuna].filter(Boolean).join(' · ') || 'Sin información adicional'));
        if (section === 'hogares') body.append(node('p', '', [row.comuna, row.region].filter(Boolean).join(' · ') || 'Ubicación sin informar'), node('p', '', 'Acoge: ' + valueText(row.especie) + ' · Tamaño: ' + valueText(row['tamaño'])));
        if (section === 'articulos') body.append(node('p', '', 'Actualizado: ' + displayDate(row.updated_at)));
        body.append(node('p', 'admin-card-description', valueText(section === 'articulos' ? row.contenido : row.descripcion)));
        if (section !== 'articulos') {
          const owner = node('p', 'admin-card-owner'); owner.append(node('strong', '', 'Responsable: '), document.createTextNode(ownerName(row))); body.append(owner);
        }
        const actions = node('div', 'admin-card-actions');
        const detail = button('Ver ficha', 'btn-outline', () => openDetail(row, section)); detail.dataset.action = 'detail'; actions.append(detail);
        if (section === 'articulos') { const edit = button('Editar', 'btn-green', () => openEditor(row)); edit.dataset.action = 'edit'; actions.append(edit); }
        if (Object.hasOwn(DELETE_ACTIONS, section)) {
          const remove = button('Eliminar', 'admin-btn-danger-outline', () => confirmDelete(row, section)); remove.dataset.action = 'delete'; actions.append(remove);
        }
        body.append(actions); card.append(body); container.append(card);
      });
    }
    const pages = Math.max(1, Math.ceil(state.total / state.size));
    $('#admin-page-label').textContent = 'Página ' + state.page + ' de ' + pages;
    $('#admin-pagination').hidden = !state.total;
    $('#admin-page-prev').disabled = state.page <= 1;
    $('#admin-page-next').disabled = state.page >= pages;
  }

  function detailField(container, label, value, wide = false) {
    const field = node('dl', 'admin-detail-field' + (wide ? ' admin-detail-wide' : ''));
    field.append(node('dt', '', label), node('dd', '', valueText(value))); container.append(field);
  }
  function openDetail(row, section) {
    if (!state.authorized) return;
    $('#admin-detail-title').textContent = recordName(row, section);
    $('#admin-detail-type').textContent = SECTIONS[section].title;
    const content = $('#admin-detail-body'); content.replaceChildren();
    const urls = photos(row, section);
    if (urls.length) {
      const gallery = node('div', 'admin-detail-gallery'); gallery.tabIndex = 0;
      window.PawPhotos.mountCarousel(gallery, urls, recordName(row, section));
      gallery.querySelectorAll('img').forEach(image => { image.referrerPolicy = 'no-referrer'; });
      content.append(gallery);
    }
    const grid = node('div', 'admin-detail-grid');
    if (section === 'adopciones') {
      for (const [label, value] of [['Estado', statusFor(row, section)[0]], ['Especie', row.especie], ['Raza', row.raza],
        ['Edad', row.edad], ['Tamaño', row.tamano], ['Esterilización', row.esterilizado], ['Vacunas', row.vacunas],
        ['Región', row.region], ['Comuna', row.comuna], ['Contacto', row.contacto], ['Teléfono', row.telefono],
        ['Responsable', ownerName(row)], ['Correo del responsable', row.responsable?.email]]) detailField(grid, label, value);
    } else if (section === 'hogares') {
      for (const [label, value] of [['Disponibilidad', statusFor(row, section)[0]], ['Especies aceptadas', row.especie],
        ['Tamaños aceptados', row['tamaño']], ['Región', row.region], ['Comuna', row.comuna],
        ['Contacto', row.contacto], ['Teléfono', row.telefono], ['Responsable', ownerName(row)],
        ['Correo del responsable', row.responsable?.email]]) detailField(grid, label, value);
    } else detailField(grid, 'Estado', statusFor(row, section)[0]);
    detailField(grid, section === 'articulos' ? 'Contenido' : 'Descripción', section === 'articulos' ? row.contenido : row.descripcion, true);
    detailField(grid, 'Registro', displayDate(row.created_at));
    if (row.updated_at) detailField(grid, 'Última modificación', displayDate(row.updated_at));
    detailField(grid, 'Identificador', row.id, true);
    content.append(grid); $('#admin-detail-dialog').showModal();
  }
  function confirmDelete(row, section) {
    if (!state.authorized || !Object.hasOwn(DELETE_ACTIONS, section)) return;
    state.pendingDelete = {id: row.id, section, name: recordName(row, section)};
    $('#admin-confirm-title').textContent = section === 'articulos' ? '¿Eliminar este artículo?' : '¿Eliminar esta publicación?';
    $('#admin-confirm-description').textContent = 'Vas a eliminar «' + state.pendingDelete.name + '» de PawID.';
    message($('#admin-confirm-error'), '');
    $('#admin-confirm-delete').textContent = 'Sí, eliminar';
    $('#admin-confirm-dialog').showModal();
  }
  function deletionBusy(busy) {
    state.deleting = busy;
    ['admin-confirm-delete', 'admin-confirm-cancel', 'admin-confirm-close'].forEach(id => { $('#' + id).disabled = busy; });
    $('#admin-confirm-delete').textContent = busy ? 'Eliminando…' : 'Sí, eliminar';
  }
  async function deleteConfirmed() {
    if (!state.authorized || !state.pendingDelete || state.deleting) return;
    const pending = state.pendingDelete, epoch = state.epoch;
    deletionBusy(true); message($('#admin-confirm-error'), '');
    try {
      await api.call(DELETE_ACTIONS[pending.section], {id: pending.id, confirmar: true});
      if (epoch !== state.epoch || !state.authorized) return;
      $('#admin-confirm-dialog').close(); state.pendingDelete = null;
      state.page = Math.min(state.page, Math.max(1, Math.ceil((state.total - 1) / state.size)));
      feedback(pending.section === 'articulos' ? 'Artículo eliminado correctamente.' : 'Publicación eliminada correctamente.');
      await loadCurrent();
    } catch (error) {
      if (epoch === state.epoch && state.authorized) message($('#admin-confirm-error'), error.message, true);
    } finally { deletionBusy(false); }
  }
  function previewArticle() {
    const image = $('#admin-article-preview'), value = $('#admin-article-image').value.trim();
    const url = /^https?:\/\//i.test(value) ? imageURL(value, config, false) : '';
    image.hidden = !url;
    if (url) image.src = url; else image.removeAttribute('src');
  }
  function openEditor(row = null) {
    if (!state.authorized) return;
    state.editing = row?.id || null;
    $('#admin-article-form').reset(); message($('#admin-article-error'), '');
    $('#admin-article-title').textContent = row ? 'Editar artículo' : 'Crear artículo';
    $('#admin-article-name').value = row?.titulo || '';
    $('#admin-article-content').value = row?.contenido || '';
    $('#admin-article-image').value = row?.imagen_url || '';
    $('#admin-article-published').checked = row?.publicado === true;
    editorBusy(false); previewArticle(); $('#admin-article-dialog').showModal();
  }
  function editorBusy(busy) {
    state.saving = busy; $('#admin-article-fields').disabled = busy;
    ['admin-article-save', 'admin-article-close', 'admin-article-cancel'].forEach(id => { $('#' + id).disabled = busy; });
    $('#admin-article-save').textContent = busy ? 'Guardando…' : 'Guardar artículo';
  }
  async function saveArticle(event) {
    event.preventDefault();
    if (!state.authorized || state.saving || !$('#admin-article-form').reportValidity()) return;
    const editing = state.editing, epoch = state.epoch;
    const article = {titulo: $('#admin-article-name').value.trim(), contenido: $('#admin-article-content').value.trim(),
      imagen_url: $('#admin-article-image').value.trim() || null, publicado: $('#admin-article-published').checked};
    if (!article.titulo || !article.contenido) { message($('#admin-article-error'), 'Completa el título y el contenido del artículo.', true); return; }
    editorBusy(true); message($('#admin-article-error'), '');
    try {
      await api.call(editing ? 'editar_articulo' : 'crear_articulo', editing ? {id: editing, articulo: article} : {articulo: article});
      if (epoch !== state.epoch || !state.authorized) return;
      $('#admin-article-dialog').close(); state.editing = null; state.page = 1;
      feedback(editing ? 'Artículo actualizado correctamente.' : 'Artículo creado correctamente.');
      await loadCurrent();
    } catch (error) {
      if (epoch === state.epoch && state.authorized) message($('#admin-article-error'), error.message, true);
    } finally { editorBusy(false); }
  }

  async function bootstrap() {
    try {
      if (!window.supabase?.createClient || !config?.supabaseUrl || !config?.publishableKey) throw new Error('No se pudo cargar la conexión de PawID. Revisa tu conexión y vuelve a cargar la página.');
      client = window.supabase.createClient(config.supabaseUrl, config.publishableKey, {
        auth: {storageKey: STORAGE_KEY, storage: window.sessionStorage, persistSession: true,
          autoRefreshToken: true, detectSessionInUrl: false}
      });
      api = createAPI(client, denyAccess);
      client.auth.onAuthStateChange(event => {
        // No se realizan llamadas asíncronas al SDK dentro de su callback de Auth.
        if (event === 'SIGNED_OUT' && state.authorized && !state.loggingOut) showLogin('Tu sesión se cerró. Inicia sesión nuevamente.', true);
      });
      await authorize(initialSection);
    } catch (error) {
      showLogin(error.message || 'No se pudo comprobar la sesión. Intenta nuevamente.', true);
      if (!client) $('#admin-login-fields').disabled = true;
    } finally {
      $('#admin-login-status').hidden = true;
      if (fromMainLogin && !$('#admin-login').hidden && !$('#admin-login-fields').disabled) $('#admin-password').focus();
    }
  }
  $('#admin-login-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!api || $('#admin-login-fields').disabled) return;
    loginBusy(true); message($('#admin-login-message'), '');
    try {
      await api.login($('#admin-email').value, $('#admin-password').value);
      $('#admin-password').value = '';
      await authorize();
    } catch (error) { showLogin(error.message || 'No se pudo iniciar sesión.', true); }
    finally { $('#admin-password').value = ''; loginBusy(false); }
  });
  $('#admin-password-toggle').addEventListener('click', () => {
    const visible = $('#admin-password').type === 'password';
    $('#admin-password').type = visible ? 'text' : 'password';
    $('#admin-password-toggle').textContent = visible ? 'Ocultar' : 'Mostrar';
    $('#admin-password-toggle').setAttribute('aria-pressed', String(visible));
    $('#admin-password-toggle').setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
  $('#admin-logout').addEventListener('click', async () => {
    if (state.loggingOut) return;
    state.loggingOut = true; showLogin('Cerrando sesión…'); loginBusy(true);
    try {
      const result = await closeAdminSession();
      message($('#admin-login-message'), result?.error ? 'El acceso se cerró en este navegador. No se pudo confirmar el cierre en el servidor.' : 'Sesión cerrada correctamente.', !!result?.error);
    } catch { message($('#admin-login-message'), 'El acceso se cerró en este navegador. No se pudo confirmar el cierre en el servidor.', true); }
    finally { state.loggingOut = false; loginBusy(false); }
  });
  all('[data-section]').forEach(element => element.addEventListener('click', () => navigate(element.dataset.section)));
  $('#admin-menu-toggle').addEventListener('click', () => menu($('#admin-sidebar').dataset.open !== 'true'));
  $('#admin-menu-backdrop').addEventListener('click', () => menu(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') menu(false); });
  $('#admin-refresh').addEventListener('click', () => { feedback(''); loadCurrent(); });
  $('#admin-retry').addEventListener('click', () => loadCurrent());
  $('#admin-page-size').addEventListener('change', () => { state.size = Number($('#admin-page-size').value); state.page = 1; loadCurrent(); });
  $('#admin-page-prev').addEventListener('click', () => { if (!state.loading && state.page > 1) { state.page--; loadCurrent(); } });
  $('#admin-page-next').addEventListener('click', () => { if (!state.loading && state.page * state.size < state.total) { state.page++; loadCurrent(); } });
  ['admin-detail-close', 'admin-detail-done'].forEach(id => $('#' + id).addEventListener('click', () => $('#admin-detail-dialog').close()));
  ['admin-confirm-close', 'admin-confirm-cancel'].forEach(id => $('#' + id).addEventListener('click', () => { if (!state.deleting) $('#admin-confirm-dialog').close(); }));
  $('#admin-confirm-dialog').addEventListener('cancel', event => { if (state.deleting) event.preventDefault(); });
  $('#admin-confirm-delete').addEventListener('click', deleteConfirmed);
  $('#admin-new-article').addEventListener('click', () => openEditor());
  ['admin-article-close', 'admin-article-cancel'].forEach(id => $('#' + id).addEventListener('click', () => { if (!state.saving) $('#admin-article-dialog').close(); }));
  $('#admin-article-dialog').addEventListener('cancel', event => { if (state.saving) event.preventDefault(); });
  $('#admin-article-form').addEventListener('submit', saveArticle);
  $('#admin-article-image').addEventListener('input', previewArticle);
  $('#admin-article-preview').addEventListener('error', () => { $('#admin-article-preview').hidden = true; });
  window.addEventListener('hashchange', () => { if (state.authorized) navigate(Object.hasOwn(SECTIONS, location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard'); });
  window.addEventListener('pageshow', event => { if (event.persisted) { showLogin(); loginBusy(true); authorize().catch(error => showLogin(error.message, true)); } });
  bootstrap();
})();
