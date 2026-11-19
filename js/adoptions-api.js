/* Sesiones del servidor para el login heredado de PawID; nunca confía en ownerId del navegador. */
(function (root) {
  const SESSION_KEY = 'pawid_server_session';
  function create(client) {
    async function request(action, extra = {}) {
      const token = localStorage.getItem(SESSION_KEY);
      const { data, error } = await client.functions.invoke('pawid-api', {
        body: { ...extra, action }, headers: token ? { 'x-pawid-session': token } : {}
      });
      if (error || !data?.ok) {
        let details = data;
        const status = error?.context?.status || 0;
        if (!details && error?.context?.json) { try { details = await error.context.json(); } catch {} }
        const message = status === 404
          ? 'Falta desplegar la función pawid-api en el proyecto Supabase configurado.'
          : details?.message || (status === 401 ? 'Tu sesión venció o los datos de acceso no son correctos.'
            : 'No se pudo conectar con pawid-api. Revisa su despliegue, PAWID_APP_URL y la conexión.');
        throw Object.assign(new Error(message), {status});
      }
      return data;
    }
    return {
      request,
      hasSession: () => !!localStorage.getItem(SESSION_KEY),
      clear: () => localStorage.removeItem(SESSION_KEY),
      async login(email, password, provider = 'email') {
        const data = await request('login', { email, password, provider });
        localStorage.setItem(SESSION_KEY, data.token);
        return data.user;
      },
      async logout() { try { await request('logout'); } finally { localStorage.removeItem(SESSION_KEY); } },
      async uploadPhoto(file) {
        const prepared = await request('prepare-photo-upload', {name: file.name, type: file.type, size: file.size});
        const {error} = await client.storage.from(prepared.bucket).uploadToSignedUrl(prepared.path, prepared.token, file);
        if (error) throw new Error('No se pudo subir la fotografía. Intenta nuevamente; las fotos anteriores se conservan.');
        return prepared.url;
      }
    };
  }
  root.PawAdoptionsAPI = { create };
})(window);
