/* Selectores compartidos: las URLs guardadas se conservan hasta quitarlas. */
(function (root) {
  const MAX_PHOTOS = 8;
  function petImages(pet) {
    const saved = Array.isArray(pet?.fotos) ? pet.fotos.filter(Boolean) : [];
    return saved.length ? saved : (pet?.foto_path ? [pet.foto_path] : []);
  }
  function createPicker(input, container, notify = message => alert(message)) {
    let entries = [], busy = false;
    const release = entry => { if (entry.preview) URL.revokeObjectURL(entry.preview); };
    function render() {
      container.replaceChildren();
      entries.forEach((entry, index) => {
        const figure = document.createElement('figure');
        const img = document.createElement('img');
        img.src = entry.url || entry.preview;
        img.alt = 'Foto ' + (index + 1);
        const remove = document.createElement('button');
        remove.type = 'button'; remove.textContent = 'Quitar foto ' + (index + 1); remove.disabled = busy;
        remove.onclick = () => { if (busy) return; release(entry); entries.splice(index, 1); render(); };
        figure.append(img, remove); container.append(figure);
      });
    }
    input.addEventListener('change', () => {
      const files = Array.from(input.files || []);
      if (entries.length + files.length > MAX_PHOTOS || files.some(f => !f.type.startsWith('image/') || f.size > 10485760)) {
        notify('Selecciona hasta 8 imágenes de máximo 10 MB cada una.');
      } else if (!busy) {
        entries.push(...files.map(file => ({ file, preview: URL.createObjectURL(file) })));
        render();
      }
      input.value = '';
    });
    return {
      reset(urls = []) { entries.forEach(release); entries = urls.map(url => ({url})); input.value = ''; render(); },
      setBusy(value) { busy = value; input.disabled = value; render(); },
      async save(upload) {
        const urls = [];
        for (const entry of entries) {
          if (!entry.url) entry.url = await upload(entry.file);
          urls.push(entry.url);
        }
        return urls;
      }
    };
  }
  function mountCarousel(container, urls, name = 'Mascota') {
    container.replaceChildren();
    container.classList.add('pet-carousel');
    let index = 0;
    const img = document.createElement('img'); img.alt = name;
    if (!urls.length) { container.textContent = '🐾'; container.onkeydown = null; return; }
    const controls = document.createElement('div'); controls.className = 'pet-carousel-controls';
    const prev = document.createElement('button'), next = document.createElement('button'), position = document.createElement('span');
    prev.type = next.type = 'button'; prev.textContent = '❮'; next.textContent = '❯';
    prev.setAttribute('aria-label', 'Foto anterior'); next.setAttribute('aria-label', 'Foto siguiente');
    position.setAttribute('aria-live', 'polite');
    const show = delta => { index = (index + delta + urls.length) % urls.length; img.src = urls[index]; position.textContent = (index + 1) + ' / ' + urls.length; };
    prev.onclick = () => show(-1); next.onclick = () => show(1);
    prev.hidden = next.hidden = urls.length < 2;
    controls.append(prev, position, next); container.append(img, controls);
    container.onkeydown = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); show(e.key === 'ArrowLeft' ? -1 : 1); } };
    show(0);
  }
  root.PawPhotos = { createPicker, petImages, mountCarousel };
})(window);
