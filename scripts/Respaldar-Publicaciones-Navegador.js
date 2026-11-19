/* Ejecutar SOLO en la consola de la web PawID donde están guardadas las publicaciones.
   Descarga un archivo local; no envía información por red ni incluye sesiones o contraseñas. */
(function () {
  const data = {fecha: new Date().toISOString(), origen: location.origin, datos: {}};
  for (const key of ['pawid_adoptions','pawid_homes','pawid_pet_extras','pawid_adoptions_migrated']) {
    const value = localStorage.getItem(key);
    if (value !== null) { try { data.datos[key] = JSON.parse(value); } catch { data.datos[key] = value; } }
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'pawid-publicaciones-respaldo.json';
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
})();
