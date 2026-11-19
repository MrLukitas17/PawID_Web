/* Sin dependencias. Ejecutar con: node tests/checks.cjs */
async function runPawidChecks(sources) {
  const results = [];
  function check(condition, name) {
    if (!condition) throw new Error(name);
    results.push(name);
  }
  for (const name of ['app', 'registration', 'google']) {
    new Function(sources[name]);
    check(true, 'Sintaxis: ' + name);
  }
  const app = sources.app;
  const imagesCode = app.slice(app.indexOf('function getAdoptionImages('), app.indexOf('function getPrimaryAdoptionImage('));
  const getImages = new Function(imagesCode + '; return getAdoptionImages;')();
  check(JSON.stringify(getImages({ image: 'old.jpg' })) === '["old.jpg"]', 'Publicación antigua de una imagen');
  check(getImages({ images: ['a', 'b'], image: 'old' }).join() === 'a,b', 'Orden de múltiples fotos guardadas');
  check(getImages({ images: [], image: 'old' })[0] === 'old', 'Compatibilidad con arreglo vacío');
  check(getImages({}).length === 0, 'Publicación sin foto');
  function element() {
    return { children: [], value: '', replaceChildren() { this.children = []; },
      append(...items) { this.children.push(...items); }, addEventListener(type, fn) { this[type] = fn; } };
  }
  const input = element(), box = element(), alerts = [], revoked = [];
  const photoWindow = {};
  new Function('window', 'document', 'URL', sources.photos)(photoWindow,
    { createElement: element }, { createObjectURL: f => 'blob:' + f.name, revokeObjectURL: u => revoked.push(u) });
  const picker = photoWindow.PawPhotos.createPicker(input, box, msg => alerts.push(msg));
  input.files = [{name: 'a', type: 'image/png', size: 10}, {name: 'b', type: 'image/jpeg', size: 20}];
  input.change();
  check(box.children.length === 2, 'Selección múltiple y vista previa compartida');
  box.children[0].children[1].onclick();
  check(box.children.length === 1 && revoked[0] === 'blob:a', 'Quitar una foto y liberar vista previa');
  input.files = [{name: 'c', type: 'image/png', size: 10}]; input.change();
  let saved = await picker.save(async f => 'https://test/' + f.name);
  check(saved.join() === 'https://test/b,https://test/c', 'Agregar selecciones sucesivas y guardar en orden');
  picker.reset(['https://test/old1', 'https://test/old2']);
  let uploads = 0;
  saved = await picker.save(async () => { uploads++; });
  check(saved.length === 2 && uploads === 0, 'Editar sin cambios conserva fotos existentes sin subirlas otra vez');
  box.children[0].children[1].onclick();
  input.files = [{name: 'd', type: 'image/png', size: 10}]; input.change();
  saved = await picker.save(async f => 'https://test/' + f.name);
  check(saved.join() === 'https://test/old2,https://test/d', 'Quitar foto existente y agregar otra al editar');
  input.files = Array(8).fill({name: 'x', type: 'image/png', size: 10}); input.change();
  check(box.children.length === 2 && alerts.length === 1, 'Límite de ocho fotos conserva selección');
  input.files = [{name: 'x', type: 'text/plain', size: 10}]; input.change();
  input.files = [{name: 'x', type: 'image/png', size: 10485761}]; input.change();
  check(box.children.length === 2 && alerts.length === 3, 'Rechazo de archivos inválidos y demasiado grandes');
  check(photoWindow.PawPhotos.petImages({foto_path: 'old'})[0] === 'old' &&
    photoWindow.PawPhotos.petImages({fotos: [], foto_path: ''}).length === 0 &&
    photoWindow.PawPhotos.petImages({fotos: [], foto_path: 'old'})[0] === 'old', 'Compatibilidad de una foto y eliminación expresa de todas');
  const carouselCode = app.slice(app.indexOf('function renderAdoptionCarousel()'), app.indexOf('function openAdoptionDetail('));
  const nodes = Object.fromEntries(['image', 'prev', 'next', 'dots', 'position'].map(k => [k, { innerHTML: '', textContent: '' }]));
  function carousel(images, index) {
    new Function('$', 'adoptionCarouselState', 'escapeAttr', carouselCode + ';renderAdoptionCarousel();')(
      s => nodes[s.replace('#adoption-detail-', '').replace('#adoption-carousel-', '')],
      { images, index, name: 'Luna' }, v => v
    );
  }
  carousel(['a', 'b'], 1);
  check(nodes.position.textContent === '2 / 2' && nodes.image.innerHTML.includes('src="b"') && !nodes.prev.hidden, 'Carrusel: foto actual, controles y posición');
  carousel(['old'], 0);
  check(nodes.position.textContent === '1 / 1' && nodes.prev.hidden && nodes.next.hidden, 'Carrusel: publicación de una foto');
  check(app.includes('pawStore.savePublication') && !app.includes('setLocalItems('), 'Publicaciones usan la capa de Supabase sin guardado local');
  check(sources.registration.includes('petStore.createPet') && !sources.registration.includes('petAPI'), 'Registro usa el sistema compatible');
  const recoveryNodes={};
  const recoveryCode=app.slice(app.indexOf('const recoveryModal='),app.indexOf('function normalizePhone'));
  const recovery=new Function('$','pawStore','normalize',recoveryCode+';return openPasswordRecovery;')(
    selector=>recoveryNodes[selector]||(recoveryNodes[selector]=element()),{},v=>v);
  recoveryNodes['#password-recovery-form']=Object.assign(element(),{reset(){}});
  recovery();
  check(recoveryNodes['#recovery-message'].textContent.includes('código de recuperación'),'Recuperación pide el correo para enviar el código');
  check(!recoveryNodes['#recovery-email-label'].hidden&&recoveryNodes['#recovery-new-fields'].hidden,'Nueva contraseña solo se pide después de validar el código');
  return results;
}
if (typeof module !== 'undefined') {
  module.exports = runPawidChecks;
  if (require.main === module) {
    const fs = require('node:fs');
    const path = require('node:path');
    const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
    runPawidChecks({ app: read('js/app.js'), registration: read('js/registrar-mascota.js'), google: read('js/google-auth.js'), photos: read('js/photos.js'), sql: read('supabase/migrations/202610200001_public_ids_recovery.sql') })
      .then(results => console.log(results.length + ' comprobaciones correctas\n' + results.join('\n')))
      .catch(error => { console.error(error); process.exitCode = 1; });
  }
}
