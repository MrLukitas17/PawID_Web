// Pruebas de UI en Chrome con HTML, CSS y JS reales, sin servicios reales.
setTimeout(async () => {
  const $ = selector => document.querySelector(selector), checks = [];
  const check = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function until(condition) {
    for (let index = 0; index < 120; index++) { if (condition()) return; await wait(20); }
    throw new Error('La interfaz no completó la operación esperada.');
  }
  function submit(selector) { $(selector).dispatchEvent(new Event('submit', {bubbles: true, cancelable: true})); }
  function noOverflow(label) { check(document.documentElement.scrollWidth <= innerWidth + 1, label); }
  async function login(email = 'admin@example.test', password = 'prueba-local') {
    $('#admin-email').value = email; $('#admin-password').value = password; submit('#admin-login-form');
    await until(() => !$('#admin-login-fields').disabled);
  }
  async function section(name) {
    $('.admin-nav [data-section="' + name + '"]').click();
    await until(() => $('#admin-section-title').textContent === ({dashboard: 'Resumen general', adopciones: 'Adopciones', hogares: 'Hogares temporales', articulos: 'Artículos'})[name] && $('#admin-loading').hidden);
  }
  function report(value) {
    const output = document.createElement('pre'); output.id = 'admin-browser-results'; output.hidden = true;
    output.textContent = JSON.stringify(value); document.body.append(output);
    if (parent !== window) parent.postMessage({adminBrowserReport: output.textContent}, '*');
  }
  try {
    await until(() => !$('#admin-login-fields').disabled);
    check($('#admin-app').hidden && !$('#admin-login').hidden, 'Sin sesión solo muestra el login administrativo');
    check($('#admin-email').value === 'admin.pawid@gmail.com' && !$('#admin-password').value
      && $('#admin-login-description').textContent.includes('contraseña administrativa'), 'Desde el login normal completa solo el correo y solicita la contraseña administrativa');
    check(adminTest.calls.length === 0 && !$('#admin-records').textContent, 'Sin sesión no carga datos privados');
    check(adminTest.options.auth.storage === sessionStorage && adminTest.options.auth.storageKey === 'pawid-admin-auth-v1', 'Sesión oficial aislada de PawID normal');
    check(adminTest.options.auth.persistSession && !adminTest.options.auth.detectSessionInUrl, 'Auth usa persistencia propia sin procesar retornos del login normal');
    sessionStorage.setItem('pawid_user', '{"role":"admin","nombre":"Usuario normal"}');
    check($('#admin-app').hidden, 'Un rol escrito en el navegador no abre el panel');
    noOverflow('Login sin desbordamiento horizontal');
    await login('admin@example.test', 'incorrecta');
    check($('#admin-app').hidden && !$('#admin-login-message').hidden && !$('#admin-password').value, 'Credenciales rechazadas muestran error y limpian la contraseña');
    adminTest.logoutDelay = 100;
    $('#admin-email').value = 'normal@example.test'; $('#admin-password').value = 'prueba-local'; submit('#admin-login-form');
    await until(() => adminTest.logouts.length > 0);
    check($('#admin-login-fields').disabled, 'Un acceso denegado termina de cerrar su sesión antes de permitir otro login');
    await until(() => !$('#admin-login-fields').disabled); adminTest.logoutDelay = 0;
    check($('#admin-app').hidden && $('#admin-login-message').textContent.includes('Acceso denegado'), 'Auth válido sin rol admin no abre datos privados');
    check(!sessionStorage.getItem('pawid-admin-auth-v1') && adminTest.logouts.at(-1).scope === 'local', 'Acceso denegado cierra solamente la sesión administrativa');
    const normalSession = sessionStorage.getItem('pawid_user');
    await login();
    await until(() => !$('#admin-dashboard').hidden);
    check(!$('#admin-app').hidden && $('#stat-adoptions').textContent === '2' && $('#admin-account-email').textContent === 'admin@example.test', 'Dashboard verifica permiso y muestra estadísticas e identidad');
    check(!$('.admin-nav [data-section="usuarios"]') && !$('.admin-nav [data-section="mascotas"]') &&
      !$('#stat-users') && !$('#stat-pets') && document.querySelectorAll('.admin-stat-card').length === 3,
      'Usuarios y Mascotas desaparecen del menú y del dashboard');
    check($('#stat-adoptions-active').textContent === '1' && $('#stat-adoptions-inactive').textContent === '1' && $('#stat-homes-available').textContent === '1' && $('#stat-articles-drafts').textContent === '1', 'Tarjetas distinguen estados de publicaciones y artículos');
    check(adminTest.calls.every(call => call.name === 'pawid-admin' && /^Bearer mock-/.test(call.authorization)), 'Todas las acciones usan pawid-admin con JWT oficial');
    check(!$('#admin-password').value && !sessionStorage.getItem('pawid-admin-auth-v1').includes('prueba-local'), 'No persiste la contraseña');
    noOverflow('Dashboard sin desbordamiento horizontal');
    if (innerWidth <= 820) {
      $('#admin-menu-toggle').click();
      check($('#admin-sidebar').dataset.open === 'true' && !$('#admin-menu-backdrop').hidden, 'Menú móvil accesible abre con fondo');
      $('#admin-menu-backdrop').click();
      check($('#admin-menu-toggle').getAttribute('aria-expanded') === 'false', 'Menú móvil cierra al tocar el fondo');
    }
    for (const removed of ['usuarios', 'mascotas']) {
      location.hash = removed;
      await until(() => location.hash === '#dashboard' && $('#admin-loading').hidden);
    }
    check(!adminTest.calls.some(call => ['listar_usuarios', 'listar_mascotas'].includes(call.body.action)),
      'Las rutas retiradas vuelven al dashboard sin consultar usuarios ni mascotas');
    const originalAdoptions = adminTest.adoptions.slice();
    adminTest.adoptions.push(...Array.from({length: 12}, (_, index) => ({...originalAdoptions[1], id: 'extra-' + index})));
    await section('adopciones');
    check($('#admin-records').children.length === 12 && $('#admin-page-label').textContent.includes('1 de 2'), 'Publicaciones paginadas con total real');
    $('#admin-page-next').click(); await until(() => $('#admin-page-label').textContent.includes('2 de 2') && $('#admin-loading').hidden);
    check(adminTest.calls.at(-1).body.pagina === 2, 'Paginación consulta la segunda página');
    adminTest.adoptions = originalAdoptions;
    await section('adopciones');
    await until(() => $('#admin-records .admin-record-image img').complete);
    const coverBounds = $('#admin-records .admin-record-image').getBoundingClientRect();
    const photoBounds = $('#admin-records .admin-record-image img').getBoundingClientRect();
    check(photoBounds.top >= coverBounds.top - 1 && photoBounds.bottom <= coverBounds.bottom + 1 &&
      $('#admin-records .admin-record-body').getBoundingClientRect().top >= photoBounds.bottom - 1,
      'La fotografía queda contenida en la tarjeta sin superponerse al texto');
    $('#admin-records [data-action="detail"]').click();
    check($('#admin-detail-dialog').open && $('#admin-detail-body').textContent.includes('Ana Pérez'), 'Ficha de publicación muestra su responsable');
    check($('#admin-detail-body .pet-carousel-controls span').textContent === '1 / 2', 'Ficha reutiliza galería de PawID');
    const galleryBounds = $('#admin-detail-body .admin-detail-gallery').getBoundingClientRect();
    const galleryPhoto = $('#admin-detail-body .admin-detail-gallery img').getBoundingClientRect();
    check(galleryPhoto.bottom <= galleryBounds.bottom + 1 && galleryPhoto.top >= galleryBounds.top - 1, 'Galería ajusta la imagen dentro de su altura disponible');
    $('#admin-detail-body .pet-carousel-controls button:last-child').click();
    check($('#admin-detail-body .pet-carousel-controls span').textContent === '2 / 2', 'Galería permite revisar las fotografías');
    const detailRect = $('#admin-detail-dialog').getBoundingClientRect();
    check(detailRect.left >= 0 && detailRect.right <= innerWidth + 1 && detailRect.height <= innerHeight, 'Ficha contenida en pantalla');
    $('#admin-detail-close').click();
    const originalName = adminTest.adoptions[0].nombre;
    adminTest.adoptions[0].nombre = '<img src=x onerror="window.adminXss=true">';
    await section('adopciones');
    check($('#admin-records h2').textContent.includes('<img') && !window.adminXss && !$('#admin-records h2 img'), 'Texto no confiable se muestra sin interpretar HTML');
    adminTest.adoptions[0].nombre = originalName;
    await section('adopciones');
    $('#admin-records [data-action="detail"]').click();
    check($('#admin-detail-body').textContent.includes('En adopción') && $('#admin-detail-body').textContent.includes('ana@example.test'), 'Ficha de adopción incluye estado y responsable');
    $('#admin-detail-close').click();
    const beforeDelete = adminTest.calls.filter(call => call.body.action === 'eliminar_adopcion').length;
    $('#admin-records [data-action="delete"]').click();
    check($('#admin-confirm-dialog').open && adminTest.calls.filter(call => call.body.action === 'eliminar_adopcion').length === beforeDelete, 'Abrir confirmación no elimina la publicación');
    $('#admin-confirm-cancel').click(); check(adminTest.adoptions.length === 2, 'Cancelar conserva la publicación');
    $('#admin-records [data-action="delete"]').click(); $('#admin-confirm-delete').click();
    await until(() => !$('#admin-confirm-dialog').open && $('#admin-loading').hidden);
    const deletion = adminTest.calls.find(call => call.body.action === 'eliminar_adopcion');
    check(adminTest.adoptions.length === 1 && deletion.body.confirmar === true && !$('#admin-feedback').hidden, 'Confirmar elimina únicamente la publicación y muestra éxito');
    await section('hogares'); $('#admin-records [data-action="detail"]').click();
    check($('#admin-detail-body').textContent.includes('Perros y gatos') && $('#admin-detail-body').textContent.includes('Pequeño y mediano') && $('#admin-detail-body').textContent.includes('Ñuñoa'), 'Ficha de hogar muestra especies, tamaños, ubicación y responsable');
    $('#admin-detail-close').click();
    $('#admin-records [data-action="delete"]').click(); adminTest.failAction = 'eliminar_hogar'; $('#admin-confirm-delete').click();
    await until(() => !$('#admin-confirm-error').hidden);
    check($('#admin-confirm-dialog').open && adminTest.homes.length === 2, 'Error al eliminar conserva el modal y los registros');
    adminTest.failAction = null; $('#admin-confirm-delete').click();
    await until(() => !$('#admin-confirm-dialog').open && $('#admin-loading').hidden);
    check(adminTest.homes.length === 1 && adminTest.calls.some(call => call.body.action === 'eliminar_hogar' && call.body.confirmar === true), 'Hogar se elimina solo tras confirmación');
    await section('articulos'); $('#admin-new-article').click();
    check($('#admin-article-dialog').open && !$('#admin-article-published').checked, 'Crear artículo abre un borrador vacío');
    $('#admin-article-name').value = 'Artículo de prueba local';
    $('#admin-article-content').value = 'Contenido de prueba, sin modificar datos reales.';
    $('#admin-article-image').value = 'https://example.invalid/imagen.jpg';
    $('#admin-article-published').checked = true; submit('#admin-article-form');
    await until(() => !$('#admin-article-dialog').open && $('#admin-loading').hidden);
    const created = adminTest.articles.find(row => row.titulo === 'Artículo de prueba local');
    check(created?.publicado && created.imagen_url === 'https://example.invalid/imagen.jpg', 'Crear artículo envía título, contenido, imagen y estado');
    $('#admin-records [data-action="edit"]').click();
    check($('#admin-article-name').value === created.titulo && $('#admin-article-published').checked, 'Editar carga los datos completos del artículo');
    $('#admin-article-name').value = 'Artículo revisado'; $('#admin-article-published').checked = false;
    $('#admin-article-image').value = ''; submit('#admin-article-form');
    await until(() => !$('#admin-article-dialog').open && $('#admin-loading').hidden);
    check(created.titulo === 'Artículo revisado' && !created.publicado && created.imagen_url === null, 'Editar conserva el contenido y permite quitar imagen y guardar borrador');
    $('#admin-records [data-action="delete"]').click(); $('#admin-confirm-delete').click();
    await until(() => !$('#admin-confirm-dialog').open && $('#admin-loading').hidden);
    check(!adminTest.articles.includes(created) && adminTest.calls.some(call => call.body.action === 'eliminar_articulo' && call.body.confirmar === true), 'Eliminar artículo requiere confirmación');
    adminTest.failNext = true; $('#admin-refresh').click();
    await until(() => !$('#admin-load-error').hidden);
    check($('#admin-records-view').hidden, 'Fallo de lectura muestra error y no presenta datos obsoletos');
    $('#admin-retry').click(); await until(() => !$('#admin-records-view').hidden && $('#admin-loading').hidden);
    check($('#admin-load-error').hidden, 'Reintentar recupera la sección');
    // Comprueba cierre y recuperación de una sesión oficial sin cargar datos por adelantado.
    const savedSession = sessionStorage.getItem('pawid-admin-auth-v1');
    $('#admin-logout').click(); await until(() => !$('#admin-login-fields').disabled);
    check($('#admin-app').hidden && !$('#admin-records').children.length && !$('#admin-detail-body').children.length && !$('#admin-account-email').textContent, 'Cerrar sesión borra el contenido privado de la interfaz');
    check(sessionStorage.getItem('pawid_user') === normalSession && !sessionStorage.getItem('pawid-admin-auth-v1'), 'Cerrar administración no altera la sesión normal');
    await login(); await until(() => !$('#admin-dashboard').hidden);
    adminTest.delay = 120;
    $('.admin-nav [data-section="adopciones"]').click();
    await wait(5); $('#admin-logout').click();
    await until(() => !$('#admin-login-fields').disabled); await wait(150);
    check($('#admin-app').hidden && !$('#admin-records').children.length, 'Una respuesta tardía no vuelve a mostrar datos después de cerrar sesión');
    adminTest.delay = 12;
    const beforeRestore = adminTest.calls.length;
    sessionStorage.setItem('pawid-admin-auth-v1', savedSession);
    dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true}));
    await until(() => !$('#admin-dashboard').hidden && !$('#admin-app').hidden);
    check(adminTest.calls[beforeRestore]?.body.action === 'dashboard', 'Restaurar sesión vuelve a verificar acceso en el servidor');
    adminTest.allowed = false; await section('adopciones');
    await until(() => !$('#admin-login').hidden && !$('#admin-login-fields').disabled);
    check($('#admin-app').hidden && !sessionStorage.getItem('pawid-admin-auth-v1'), 'Revocar el permiso cierra el panel en la siguiente operación');
    adminTest.allowed = true; adminTest.malformedDashboard = true;
    await login();
    check($('#admin-app').hidden && !sessionStorage.getItem('pawid-admin-auth-v1'), 'Dashboard de otra identidad nunca habilita la interfaz');
    adminTest.malformedDashboard = false; await login();
    await until(() => !$('#admin-dashboard').hidden);
    if (document.body.dataset.preview && document.body.dataset.preview !== 'dashboard') await section(document.body.dataset.preview);
    noOverflow('Vista final sin desbordamiento horizontal');
    check(adminTest.logouts.every(options => options.scope === 'local'), 'Todos los cierres limitan su alcance a la sesión administrativa');
    report({ok: true, width: innerWidth, checks: checks.length, results: checks});
  } catch (error) { report({ok: false, width: innerWidth, checks: checks.length, results: checks, error: error.stack || String(error)}); }
}, 100);
