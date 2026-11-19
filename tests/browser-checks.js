/* Se ejecuta en Chrome con scripts y CSS reales y servicios simulados. */
setTimeout(async () => {
  const results = [];
  function check(ok, label) { if (!ok) throw new Error(label); results.push(label); }
  async function waitFor(check) { for (let i=0;i<40;i++) { if (check()) return; await new Promise(r=>setTimeout(r,25)); } throw new Error('El formulario no terminó de guardar'); }
  function addPhoto(input) {
    const file = new File([Uint8Array.from(atob(testPhoto.split(',')[1]), c=>c.charCodeAt(0))], 'nueva.png', {type:'image/png'});
    const files = new DataTransfer(); files.items.add(file); input.files = files.files; input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  try {
    await loadAdoptions();
    if (!localStorage.getItem('pawid_browser_stage')) {
      check($('#adoption-show-mine').hidden && $('#new-adoption').hidden, 'Invitado: botones ocultos desde la carga');
      showView('login');
      const entry = window.PawIDAdminEntry, destinations = [], calls = [];
      const invoke = mockClient.functions.invoke;
      mockClient.functions.invoke = async function(name, options) { calls.push(options?.body?.action); return invoke.call(this, name, options); };
      window.PawIDAdminEntry = {...entry, redirectFromLogin: (email, field) => entry.redirectFromLogin(email, field, url => destinations.push(url))};
      const loginEmail = $('#login-email'), loginPassword = $('#login-password'), loginForm = $('#form-login');
      loginEmail.value = 'ADMIN.PAWID@GMAIL.COM'; loginEmail.dispatchEvent(new Event('input', {bubbles:true}));
      check(!$('#login-admin-notice').hidden && loginPassword.hidden && !loginPassword.required && loginPassword.disabled,
        'Correo administrativo ofrece continuar sin pedir contraseña en el login normal');
      check($('#btn-login').textContent === 'Continuar como administrador' && loginForm.checkValidity(), 'Continuar como administrador admite el envío solo con correo');
      check(document.documentElement.scrollWidth <= innerWidth, 'Acceso administrativo desde login sin desbordamiento horizontal');
      loginPassword.value = 'valor-no-transmitido'; loginForm.requestSubmit();
      await new Promise(resolve => setTimeout(resolve, 0));
      check(destinations[0] === '/templates/admin.html?acceso=administrador#login' && !loginPassword.value,
        'El formulario abre el acceso administrativo sin enviar la contraseña en la URL');
      check(!calls.includes('login') && !currentUser && !pawStore.hasSession(), 'El correo administrativo nunca usa ni crea la sesión normal');
      loginForm.reset(); await new Promise(resolve => setTimeout(resolve, 0));
      check($('#login-admin-notice').hidden && !loginPassword.hidden && loginPassword.required && !loginPassword.disabled, 'Restablecer formulario recupera el acceso normal');
      loginEmail.value = entry.ADMIN_EMAIL;
      $('#btn-login').click();
      check(destinations.length === 2 && !loginPassword.required, 'Autocompletar el correo sin evento también permite continuar');
      loginEmail.value = 'owner@test.cl'; loginEmail.dispatchEvent(new Event('input', {bubbles:true}));
      check($('#login-admin-notice').hidden && !loginPassword.hidden && loginPassword.required && !loginPassword.disabled
        && $('#btn-login').textContent === 'Iniciar Sesión' && !loginForm.checkValidity(), 'Otro correo conserva contraseña obligatoria e inicio de sesión normal');
      loginPassword.value = 'password'; loginForm.requestSubmit();
      await waitFor(() => currentUser?.id === 'owner' && !$('#btn-login').disabled);
      check(calls.filter(action => action === 'login').length === 1 && destinations.length === 2 && pawStore.hasSession(), 'Usuario normal sigue ingresando desde el mismo formulario');
      window.PawIDAdminEntry = entry; mockClient.functions.invoke = invoke;
      await loadAdoptions();
      showView('adopciones');
      await new Promise(resolve => setTimeout(resolve, 200));
      check(!$('#adoption-show-mine').hidden && !$('#new-adoption').hidden, 'Inicio de sesión: botones visibles');
      check(!$('#adoption-list [data-edit-publication]')&&!$('#adoption-list [data-delete-publication]')&&!$('#adoption-list [data-adopted]'),'Todas: sin acciones de administración incluso para avisos propios');
      await markAdopted('post');
      check(!document.querySelector('[data-view-adoption="post"]'), 'Adoptada desaparece del listado público');
      adoptionViewMode = 'mine'; renderAdoptions();
      check(document.querySelector('.action-reactivate'), 'Mis publicaciones ofrece reactivación');
      const reactivation = document.querySelector('.action-reactivate'); reactivation.focus();
      await new Promise(resolve => setTimeout(resolve, 200));
      check(getComputedStyle(reactivation).backgroundColor === 'rgb(23, 100, 180)', 'Reactivar: foco azul');
      await markAdopted('post'); adoptionViewMode = 'all'; renderAdoptions();
      check(document.querySelector('[data-view-adoption="post"]'), 'Reactivada reaparece públicamente');
      check(readPosts()[0].images.length === 2, 'Estado conserva fotografías');
      localStorage.setItem('pawid_browser_stage', JSON.stringify(results)); location.reload(); return;
    }
    results.push(...JSON.parse(localStorage.getItem('pawid_browser_stage')));
    // La recarga conserva la sesion y publicaciones del sistema anterior.
    await hydrateSession(); showView('adopciones');
    check(document.querySelector('[data-view-adoption="post"]'), 'Recarga real conserva la aparición pública');
    const cards = [...document.querySelectorAll('.adoption-card')];
    check(new Set(cards.map(card => Math.round(card.getBoundingClientRect().height))).size === 1, 'Tarjetas de la misma altura');
    check(document.documentElement.scrollWidth <= innerWidth, 'Vista sin desbordamiento horizontal');
    check(!$('#adoption-list [data-edit-publication]'),'Recarga en Todas no muestra edición');
    adoptionViewMode='mine';renderAdoptions();
    const actionBox = document.querySelector('.adoption-owner-actions:has(button)');
    const buttons = [...actionBox.querySelectorAll('button')], rect = actionBox.getBoundingClientRect();
    check(getComputedStyle(actionBox).justifyContent === 'center' && getComputedStyle(actionBox).gap === '8px', 'Acciones centradas con separación uniforme');
    for (const [selector, color] of [['[data-edit-publication]','rgb(23, 100, 180)'], ['.action-adopt','rgb(245, 206, 70)'], ['[data-delete-publication]','rgb(191, 48, 43)']]) {
      const button = actionBox.querySelector(selector); button.focus();
      await new Promise(resolve => setTimeout(resolve, 200));
      check(getComputedStyle(button).backgroundColor === color, 'Color de teclado: ' + selector);
      const r = button.getBoundingClientRect(), boxRect = actionBox.getBoundingClientRect();
      check(r.top >= boxRect.top - 1 && r.bottom <= boxRect.bottom + 1, 'Botón contenido en tarjeta: ' + selector);
    }
    await openPublicationEditor('adoption:post');
    check($('#publication-photo-previews').children.length === 2, 'Edición de publicación carga fotos existentes');
    $('#publication-photo-previews button').click();
    check($('#publication-photo-previews').children.length === 1, 'Edición permite quitar una foto existente');
    addPhoto($('#publication-image'));
    check($('#publication-photo-previews').children.length === 2, 'Publicación agrega una foto nueva después de quitar otra');
    const saved = await publicationPhotoPicker.save(file=>pawStore.uploadPhoto(file));
    check(saved.length === 2 && saved[0] === testPhoto, 'Guardar conserva la foto no eliminada y la nueva');
    const title = $('#publication-title').getBoundingClientRect(), close = $('#publication-close').getBoundingClientRect(), header = document.querySelector('.publication-modal-header').getBoundingClientRect();
    check(close.top >= header.top - 1 && close.top <= header.top + 1 && close.left >= title.right + 10, 'X alineada arriba sin superponer título');
    $('#publication-close').click(); check($('#publication-modal').hidden, 'X cierra el formulario');
    await openPublicationEditor('adoption:post');
    $('#publication-photo-previews button').click(); addPhoto($('#publication-image'));
    $('#publication-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await waitFor(()=>$('#publication-modal').hidden);
    check(readPosts().find(row=>row.id==='post').images.length===2, 'Formulario de publicación guarda fotos existentes y nuevas');
    openPetModal('pet'); check($('#edit-photo-previews').children.length === 2, 'Modificar mascota carga fotos existentes');
    $('#edit-photo-previews button').click(); check($('#edit-photo-previews').children.length === 1, 'Modificar mascota permite quitar una foto');
    addPhoto($('#edit-foto'));
    check($('#edit-photo-previews').children.length === 2, 'Modificar mascota agrega una foto nueva');
    $('#form-editar-mascota').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await waitFor(()=>$('#modal-editar').hidden);
    const savedPet=(await pawStore.listPets()).find(row=>row.id==='pet');
    check(savedPet.fotos.length===2 && testPet.foto_path===savedPet.fotos[0], 'Formulario conserva galería y portada en servidor');
    openPetDetail('pet');
    check($('#detalle-mascota-foto .pet-carousel-controls span').textContent === '1 / 2', 'Ficha de mascota muestra carrusel');
    $('#detalle-mascota-foto .pet-carousel-controls button:last-child').click();
    check($('#detalle-mascota-foto .pet-carousel-controls span').textContent === '2 / 2', 'Carrusel avanza con indicador');
    $('#modal-detalle-mascota').hidden = true;
    remoteHomes=[{id:'home-own',ownerId:'owner',name:'Hogar propio',availability:'Disponible'},{id:'home-other',ownerId:'other',name:'Hogar ajeno',availability:'Disponible'}];
    homeViewMode='all';renderHomes();
    check($('#temporary-home-list').querySelectorAll('button').length===2&&$('#temporary-home-list').querySelectorAll('[data-view-home]').length===2,'Todos hogares: solo Ver ficha en ambas tarjetas');
    homeViewMode='mine';renderHomes();
    check($('#temporary-home-list [data-edit-publication]')&&$('#temporary-home-list [data-delete-publication]')&&$('#temporary-home-list [data-toggle-home]')&&$('#temporary-home-list [data-contact-home]'),'Mis publicaciones hogares: muestra todas las acciones propias');
    check(!$('#temporary-home-list [data-view-home="home-other"]'),'Mis publicaciones hogares no incluye avisos ajenos');
    check(!$('#account-edit-profile').hidden,'Cuenta permite editar perfil con sesión');
    await openProfile();
    check(!$('#profile-modal').hidden&&$('#profile-email').readOnly,'Perfil abre formulario con correo de cuenta');
    addPhoto($('#profile-photo'));await waitFor(()=>!!profilePhotoFile);
    check($('#profile-avatar img')&&$('#profile-photo-select').textContent==='Cambiar foto','Perfil muestra vista previa de la foto elegida');
    $('#profile-name').value='Tutor actualizado';$('#profile-phone').value='9 8765 4321';
    $('#profile-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    await waitFor(()=>!$('#profile-save').disabled);
    check($('#profile-message').textContent==='Perfil actualizado.'&&$('#account-name').textContent==='Tutor actualizado','Guardar perfil actualiza el menú y muestra confirmación');
    await hydrateSession();check(currentUser.nombre==='Tutor actualizado'&&currentUser.telefono==='987654321','Sesión nueva consulta el perfil guardado en servidor');
    check(currentUser.foto_path===testPhoto&&$('#account-button img'),'Foto guardada se recupera en sesión y aparece en la cuenta');
    closeProfile();
    $('#account-button img').click();check(!$('#account-menu').hidden,'Clic sobre la foto mantiene abierto el menú de cuenta');
    $('#account-edit-profile').click();check(!$('#profile-modal').hidden,'Mi cuenta abre el panel desde el menú de la foto');
    closeProfile();$('#account-button img').click();document.body.click();check($('#account-menu').hidden,'Clic fuera cierra el menú de cuenta');
    await openProfile();
    closeProfile();await openProfile();
    check($('#profile-avatar img'),'Reabrir perfil conserva foto guardada');
    $('#profile-photo-remove').click();closeProfile();await openProfile();
    check($('#profile-avatar img'),'Cancelar la eliminación conserva la foto anterior');
    $('#profile-photo-remove').click();$('#profile-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>!$('#profile-save').disabled);
    check(currentUser.foto_path===''&&!$('#account-button img'),'Guardar sin foto quita avatar y conserva perfil');
    check($('#profile-modal .modal-box').scrollWidth<=$('#profile-modal .modal-box').clientWidth,'Panel de perfil sin desbordamiento horizontal');
    closeProfile();
    remoteHomes=[{id:'home-own',ownerId:'owner',name:'Hogar de prueba',availability:'Disponible'}];openHomeDetail('home-own');check(!$('#home-detail-edit')&&$('#home-detail-contact'),'Ficha de hogar permite contactar y no tiene editar publicación');$('#home-detail-modal').hidden=true;
    await openProfile();selectAccountTab('security');
    check(!$('#account-security-pane').hidden&&!$('#account-manual-security').hidden,'Cuenta manual muestra apartado Seguridad');
    const realEmail=currentUser.email;
    await beginSecurity('email');check($('#security-change-form').hidden&&!$('#security-code-form').hidden,'Cambio de correo pide código antes de mostrar nuevo correo');
    $('#security-code').value='000000';$('#security-code-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>!$('#security-message').hidden);check($('#security-change-form').hidden,'Código incorrecto no desbloquea datos');
    $('#security-code').value='123456';$('#security-code-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>!$('#security-change-form').hidden);
    $('#security-new-email').value='nuevo@test.cl';$('#security-change-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>$('#security-change-form').hidden);check(currentUser.email===realEmail&&$('#security-message').textContent.includes('no se modificó'),'Simulación de correo no cambia credenciales reales');
    closeProfile();const manualUser=currentUser;currentUser={...currentUser,proveedor:'google'};await openProfile();selectAccountTab('security');
    check(!$('#account-google-lock').hidden&&$('#account-manual-security').hidden&&$('#profile-email').readOnly,'Google mantiene correo bloqueado y oculta cambios de credenciales');
    closeProfile();currentUser=manualUser;updateSessionUI();
    const recovery = $('#show-password-recovery'), google = $('#btn-google');
    showView('login');
    check(recovery.closest('form')?.id === 'form-login' && recovery.getBoundingClientRect().top > google.getBoundingClientRect().bottom, 'Recuperación al final del formulario');
    await logout();
    check($('#new-adoption').hidden && $('#adoption-show-mine').hidden && $('#account-edit-profile').hidden, 'Cerrar sesión oculta controles y Editar perfil');
    currentUser = await pawStore.login('owner@test.cl','password'); updateSessionUI(); showView('adopciones'); await openPublicationEditor('adoption:new');
    const output = document.createElement('pre'); output.id = 'browser-check-results'; output.hidden = true;
    output.textContent = JSON.stringify({ok:true,width:innerWidth,checks:results.length,results}); document.body.append(output);
    if (parent !== window) parent.postMessage({pawidBrowserReport: output.textContent}, '*');
  } catch (error) { browserReport(error.stack || error); }
}, 100);
